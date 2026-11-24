#!/usr/bin/env python3
"""Inspect the four final V13 browser exports, without asserting speech intelligibility.

Reads the four named WebM files and matching manifests from --input-dir or
DOOM404_V13_EXPORT_DIR (default /workspace/shared/doom404-v13/final). Writes extracted frames to final/qa and a JSON
acceptance record alongside this script. Missing final files are BLOCKED, never
substituted with earlier/rejected exports. Requires ffmpeg, ffprobe and Pillow.
"""
from __future__ import annotations
import hashlib
import io
import json
import math
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

INPUT = Path(os.environ.get('DOOM404_V13_EXPORT_DIR', '/workspace/shared/doom404-v13/final'))
OUTPUT = Path(__file__).resolve().parent / 'video-file-validation.json'
NAMES = ('usdc-doom', 'usdc-cat', 'tomo-bull', 'bonk-bore')
EXPECTED_PRESENTERS = dict(zip(NAMES, ('hud', 'hud-cat', 'hud-bull', 'hud-bore')))


def run(args, timeout=180):
    return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def frame(video, timestamp):
    proc = run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-ss', f'{timestamp:.6f}', '-i', str(video), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-threads', '1', '-'])
    if proc.returncode or not proc.stdout:
        raise RuntimeError('Frame extraction failed: ' + proc.stderr.decode(errors='replace')[-500:])
    return Image.open(io.BytesIO(proc.stdout)).convert('RGB')


def inspect(name, directory=INPUT):
    directory = Path(directory).resolve()
    video = directory / f'{name}.webm'
    manifest_path = directory / f'{name}-manifest.json'
    result = {'name': name, 'video': str(video), 'manifest': str(manifest_path), 'checks': {}}
    if not video.is_file() or not manifest_path.is_file():
        result.update(status='BLOCKED_MISSING_FINAL_FILES', missing=[str(p) for p in (video, manifest_path) if not p.is_file()])
        return result
    manifest = json.loads(manifest_path.read_text())
    exported = manifest.get('narratedExport') or {}
    timeline = manifest.get('captionTimeline') or exported.get('sceneTimeline') or []
    captions = manifest.get('captionFrames') or []
    probe = run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(video)])
    if probe.returncode:
        raise RuntimeError(probe.stderr.decode(errors='replace'))
    metadata = json.loads(probe.stdout)
    streams = metadata.get('streams', [])
    videos = [s for s in streams if s.get('codec_type') == 'video']
    audios = [s for s in streams if s.get('codec_type') == 'audio']
    vs = videos[0] if videos else {}
    audio = audios[0] if audios else {}
    width, height = int(vs.get('width', 0)), int(vs.get('height', 0))
    duration = float(metadata.get('format', {}).get('duration', 0))
    narration = float(exported.get('narrationDurationSeconds', 0))
    excess = duration - narration
    checks = result['checks']
    checks['single_portrait_vp8_video'] = len(videos) == 1 and vs.get('codec_name') == 'vp8' and width * 16 == height * 9 and width > 0
    checks['embedded_opus_audio'] = len(audios) == 1 and audio.get('codec_name') == 'opus' and audio.get('channels', 0) > 0
    checks['manifest_presenter_matches'] = exported.get('presenter') == EXPECTED_PRESENTERS[name]
    checks['manifest_dimensions_match'] = exported.get('width') == width and exported.get('height') == height
    checks['manifest_bytes_match'] = exported.get('bytes') == video.stat().st_size
    checks['manifest_embedded_audio'] = manifest.get('exportAudio') == 'EMBEDDED' and exported.get('audio') == 'EMBEDDED'
    checks['duration_matches_narration_under_one_second_excess'] = narration > 0 and -0.15 <= excess < 1.0
    checks['seven_caption_scenes'] = len(timeline) == len(captions) == 7 and all(s.get('caption') == captions[i] for i, s in enumerate(timeline))
    checks['continuous_scene_timeline'] = bool(timeline) and abs(float(timeline[0].get('startSeconds', -1))) < 0.001 and all(float(s.get('endSeconds', 0)) > float(s.get('startSeconds', 0)) for s in timeline) and all(abs(float(timeline[i]['endSeconds']) - float(timeline[i + 1]['startSeconds'])) < 0.001 for i in range(len(timeline) - 1)) and abs(float(timeline[-1].get('endSeconds', 0)) - narration) < 0.001
    final_caption = str(timeline[-1].get('caption', '')).lower() if timeline else ''
    checks['final_evidence_disclaimer_in_caption_manifest'] = 'not a token safety rating' in final_caption and 'not a synchronized snapshot' in final_caption and 'unresolved' in final_caption
    checks['version_13_manifest'] = manifest.get('version') == 13
    # Decode each elementary stream to a timestamp-free raw sink. A combined
    # null muxer can round time bases and emit output DTS warnings for otherwise
    # decodable WebM; preserve that diagnostic separately rather than hiding it.
    raw_decodes = {}
    for kind, mapping, fmt in [('video', '0:v:0', 'rawvideo'), ('audio', '0:a:0', 's16le')]:
        args = ['ffmpeg', '-hide_banner', '-v', 'error', '-xerror', '-threads', '1', '-i', str(video), '-map', mapping]
        if kind == 'video':
            args += ['-fps_mode', 'passthrough', '-enc_time_base', 'demux', '-pix_fmt', 'rgb24']
        args += ['-f', fmt, '-y', '/dev/null']
        raw = run(args)
        raw_decodes[kind] = {'returnCode': raw.returncode, 'stderr': raw.stderr.decode(errors='replace').strip()}
    checks['full_audio_video_elementary_decode_without_errors'] = all(x['returnCode'] == 0 and not x['stderr'] for x in raw_decodes.values())
    mux = run(['ffmpeg', '-hide_banner', '-v', 'warning', '-threads', '1', '-i', str(video), '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'])
    mux_warnings = mux.stderr.decode(errors='replace').strip()
    packets = run(['ffprobe', '-v', 'error', '-show_packets', '-show_entries', 'packet=stream_index,pts_time,dts_time,duration_time', '-of', 'json', str(video)])
    if packets.returncode:
        raise RuntimeError('Packet timing inspection failed: ' + packets.stderr.decode(errors='replace'))
    packet_rows = json.loads(packets.stdout).get('packets', [])
    timing = {}
    for stream in streams:
        index = stream['index']
        rows = [r for r in packet_rows if r.get('stream_index') == index]
        item = {'streamIndex': index, 'codecType': stream.get('codec_type'), 'packetCount': len(rows)}
        for clock in ('pts_time', 'dts_time'):
            previous = None
            backward = []
            for n, row in enumerate(rows):
                if clock not in row:
                    continue
                value = float(row[clock])
                if previous is not None and value < previous:
                    backward.append({'packetIndex': n, 'previousSeconds': previous, 'currentSeconds': value, 'backwardSeconds': previous - value})
                previous = value
            item[clock] = {'backwardCount': len(backward), 'maximumBackwardSeconds': max((x['backwardSeconds'] for x in backward), default=0), 'events': backward[:12]}
        valid_pts = [float(r['pts_time']) for r in rows if 'pts_time' in r]
        ends = [float(r['pts_time']) + float(r.get('duration_time', 0)) for r in rows if 'pts_time' in r]
        item['firstPacketPtsSeconds'] = min(valid_pts) if valid_pts else None
        item['lastPacketEndSeconds'] = max(ends) if ends else None
        item['packetSpanSeconds'] = max(ends) - min(valid_pts) if valid_pts and ends else None
        timing[stream.get('codec_type', str(index))] = item
    maximum_backward = max((v[c]['maximumBackwardSeconds'] for v in timing.values() for c in ('pts_time', 'dts_time')), default=0)
    checks['input_packet_backward_steps_under_20ms'] = maximum_backward < 0.020
    audio_end = timing.get('audio', {}).get('lastPacketEndSeconds')
    video_end = timing.get('video', {}).get('lastPacketEndSeconds')
    av_end_delta = abs(audio_end - video_end) if audio_end is not None and video_end is not None else None
    checks['audio_video_packet_end_drift_under_one_second'] = av_end_delta is not None and av_end_delta < 1.0
    timing_warning = bool(mux_warnings) or maximum_backward > 0
    timing_classification = 'MATERIAL_TIMESTAMP_ANOMALY' if not checks['input_packet_backward_steps_under_20ms'] or not checks['audio_video_packet_end_drift_under_one_second'] else 'BOUNDED_TIMESTAMP_WARNING_REQUIRES_REVIEW' if timing_warning else 'NO_TIMESTAMP_WARNING_OBSERVED'
    volume = run(['ffmpeg', '-hide_banner', '-nostats', '-threads', '1', '-i', str(video), '-vn', '-af', 'volumedetect', '-f', 'null', '-'])
    volume_log = volume.stderr.decode(errors='replace')
    def db(label):
        match = re.search(rf'{label}:\s*(-?inf|[-\d.]+) dB', volume_log)
        return float(match.group(1)) if match else None
    mean, maximum = db('mean_volume'), db('max_volume')
    checks['audio_non_silent'] = volume.returncode == 0 and mean is not None and maximum is not None and math.isfinite(mean) and mean > -65 and maximum > -35
    qa = directory / 'qa'
    qa.mkdir(exist_ok=True)
    thumbs, scene_files = [], []
    for index, scene in enumerate(timeline):
        midpoint = (float(scene['startSeconds']) + float(scene['endSeconds'])) / 2 + 0.12
        image = frame(video, min(duration - 0.05, midpoint))
        dest = qa / f'{name}-scene-{index + 1}.png'
        image.save(dest)
        scene_files.append({'scene': index + 1, 'videoTimestampSeconds': midpoint, 'file': str(dest)})
        thumb = Image.new('RGB', (270, 506), '#111111')
        image.thumbnail((270, 480))
        thumb.paste(image, (0, 0))
        ImageDraw.Draw(thumb).text((6, 485), f'Scene {index + 1} / {midpoint:.2f}s', fill='white')
        thumbs.append(thumb)
    sheet = Image.new('RGB', (1080, 1012), '#111111')
    for i, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((i % 4) * 270, (i // 4) * 506))
    sheet_path = qa / f'{name}-contact-sheet.jpg'
    sheet.save(sheet_path, quality=90)
    # Crop contains the presenter body/face, excluding caption and evidence panels.
    # This detects visual motion, not semantic correctness of an animation.
    crop = (int(width * 120 / 540), int(height * 390 / 960), int(width * 420 / 540), int(height * 650 / 960))
    motion = []
    for fraction in (0.1, 0.4, 0.7):
        t = duration * fraction
        a, b = frame(video, t).crop(crop), frame(video, min(duration - 0.05, t + 0.7)).crop(crop)
        diff = ImageChops.difference(a, b)
        mean_difference = sum(ImageStat.Stat(diff).mean) / 3
        significant_pixels = sum(1 for p in diff.getdata() if max(p) > 20)
        fraction_changed = significant_pixels / (diff.width * diff.height)
        motion.append({'startSeconds': t, 'endSeconds': min(duration - 0.05, t + 0.7), 'meanAbsoluteRgbDifference': mean_difference, 'fractionPixelsChangingOver20': fraction_changed, 'motionDetected': mean_difference > 0.1 and fraction_changed > 0.005})
    checks['presenter_crop_motion_detected'] = sum(m['motionDetected'] for m in motion) >= 2
    result.update(status=('PASS_FILE_CHECKS_WITH_TIMING_WARNING_REQUIRES_REVIEW' if timing_warning else 'PASS_FILE_CHECKS_REQUIRES_VISUAL_AND_SPEECH_REVIEW') if all(checks.values()) else 'FAIL', bytes=video.stat().st_size, sha256=sha256(video), width=width, height=height, videoCodec=vs.get('codec_name'), audioCodec=audio.get('codec_name'), audioChannels=audio.get('channels'), durationSeconds=duration, narrationDurationSeconds=narration, recordingExcessSeconds=excess, meanVolumeDb=mean if mean is None or math.isfinite(mean) else str(mean), maxVolumeDb=maximum if maximum is None or math.isfinite(maximum) else str(maximum), elementaryStreamDecodes=raw_decodes, combinedNullMuxerReturnCode=mux.returncode, combinedNullMuxerWarnings=mux_warnings, packetTiming=timing, maximumInputBackwardSeconds=maximum_backward, audioVideoPacketEndDeltaSeconds=av_end_delta, timingClassification=timing_classification, presenterCrop=crop, animationComparisons=motion, sceneFrames=scene_files, contactSheet=str(sheet_path), limitations=['Speech intelligibility and spoken factual/numeric accuracy are not assessed by volume or codec checks.', 'Caption timeline continuity is checked against the export manifest; visual caption clipping, overlap and actual transition alignment require rendered-frame/playback review.', 'Sub-20ms packet/mux timing warnings are retained for explicit review; they are not claimed absent or equivalent to verified audiovisual synchronization.', 'Presenter crop differences demonstrate visual motion; they do not establish intended semantic animation or continuous visibility for every frame.'])
    return result


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir', type=Path, default=INPUT, help='Directory containing the four named retained WebM exports and matching manifests')
    parser.add_argument('--normalized', action='store_true', help='Inspect staged final/normalized files and their own matching manifests; never infer byte counts from raw manifests')
    args = parser.parse_args()
    directory = args.input_dir / 'normalized' if args.normalized else args.input_dir
    output = OUTPUT.with_name('video-normalized-file-validation.json') if args.normalized else OUTPUT
    report = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'inputDirectory': str(directory), 'scope': 'Only the four specifically named final browser-exported files; earlier/rejected samples are excluded.', 'speechIntelligibility': 'NOT_ASSESSED_ROOT_BROWSER_ASR_REVIEW_REQUIRED', 'files': []}
    for name in NAMES:
        try:
            report['files'].append(inspect(name, directory))
        except Exception as exc:
            report['files'].append({'name': name, 'status': 'ERROR', 'error': str(exc)})
    report['allFileChecksPassed'] = all(f.get('status') in ('PASS_FILE_CHECKS_REQUIRES_VISUAL_AND_SPEECH_REVIEW', 'PASS_FILE_CHECKS_WITH_TIMING_WARNING_REQUIRES_REVIEW') for f in report['files'])
    output.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    print(json.dumps({'output': str(output), 'allFileChecksPassed': report['allFileChecksPassed'], 'files': [{'name': f['name'], 'status': f['status'], 'failedChecks': [k for k, v in f.get('checks', {}).items() if not v]} for f in report['files']]}, indent=2))
    return 0 if report['allFileChecksPassed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
