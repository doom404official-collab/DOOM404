(function(root){'use strict';
function paginate(text,measure,width=476,maxLines=4){const words=String(text).trim().split(/\s+/).filter(Boolean),pages=[];let lines=[],line='',start=0,used=0;for(const word of words){const next=line?line+' '+word:word;if(line&&measure(next)>width){lines.push(line);line='';if(lines.length===maxLines){pages.push({lines,start,end:used});start=used;lines=[];}}line=line?line+' '+word:word;used++;}if(line)lines.push(line);if(lines.length)pages.push({lines,start,end:used});return {pages,totalWords:words.length}}
function at(layout,progress){const target=Math.max(0,Math.min(.999999,Number(progress)||0))*layout.totalWords;return layout.pages.find(p=>target<p.end)||layout.pages.at(-1)||{lines:[]}}
const api={paginate,at};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.doom404CaptionPages=api;
})(typeof window==='undefined'?null:window);
