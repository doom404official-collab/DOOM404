// Deterministic speech spelling. Never convert decimal values through Number,
// round them, or ask a model to paraphrase the supplied evidence captions.
const DIGITS=["zero","one","two","three","four","five","six","seven","eight","nine"];
const SMALL=[...DIGITS,"ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
const SCALES=["","thousand","million","billion","trillion","quadrillion","quintillion","sextillion","septillion","octillion","nonillion","decillion"];
function tripleWords(value){const n=Number(value);const parts=[];let rest=n;if(rest>=100){parts.push(DIGITS[Math.floor(rest/100)]+" hundred");rest%=100}if(rest>=20){parts.push(TENS[Math.floor(rest/10)]);if(rest%10)parts.push(DIGITS[rest%10])}else if(rest)parts.push(SMALL[rest]);return parts.join(" ")}
function wholeWords(raw){const digits=raw.replace(/,/g,"").replace(/^0+(?=\d)/,"");if(digits==="0")return "zero";const groups=[];for(let end=digits.length;end>0;end-=3)groups.push(digits.slice(Math.max(0,end-3),end));if(groups.length>SCALES.length)return [...digits].map(d=>DIGITS[Number(d)]).join(" ");return groups.map((g,i)=>{const words=tripleWords(g);return words?words+(SCALES[i]?" "+SCALES[i]:""):""}).reverse().filter(Boolean).join(" ")}
function normalizeSpeechInput(text){
  return String(text).replace(/(?<![\w.,])([-+]?\$|\$[-+]?|[-+]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%?)(?!\w|[.,]\d)/g,(all,prefix,whole,fraction,percent)=>{
    const sign=prefix.includes("-")?"minus ":prefix.includes("+")?"plus ":"";
    const decimal=fraction?" point "+[...fraction.slice(1)].map(d=>DIGITS[Number(d)]).join(" "):"";
    return sign+wholeWords(whole)+decimal+(prefix.includes("$")?" US dollars":"")+(percent?" percent":"");
  });
}
module.exports={normalizeSpeechInput,normalizationVersion:"EXPLICIT_NUMERIC_WORDS_V1"};
