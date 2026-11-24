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
    const fractionDigits=fraction?.slice(1)||"";
    if(prefix.includes("$")&&/^0+$/.test(whole.replace(/,/g,""))&&/^0{2,}[1-9]/.test(fractionDigits)){
      const leadingZeros=fractionDigits.match(/^0*/)[0].length;
      const exponent=Math.ceil((leadingZeros+1)/3)*3;
      const unit=SCALES[exponent/3];
      if(!unit)throw Error("UNSUPPORTED_FRACTIONAL_CURRENCY_SCALE");
      // Shift the decimal by a named power of ten using string slices only.
      // e.g. .000002196 * 10^6 = 2.196 millionths of one dollar.
      const coefficientWhole=fractionDigits.slice(0,exponent).padEnd(exponent,"0");
      const coefficientFraction=fractionDigits.slice(exponent).replace(/0+$/,"");
      const coefficient=wholeWords(coefficientWhole)+(coefficientFraction?" point "+[...coefficientFraction].map(d=>DIGITS[Number(d)]).join(" "):"");
      return sign+coefficient+" "+unit+"ths of one US dollar"+(percent?" percent":"");
    }
    const decimal=fraction?" point "+[...fraction.slice(1)].map(d=>DIGITS[Number(d)]).join(" "):"";
    return sign+wholeWords(whole)+decimal+(prefix.includes("$")?" US dollars":"")+(percent?" percent":"");
  });
}
module.exports={normalizeSpeechInput,normalizationVersion:"EXPLICIT_NUMERIC_WORDS_V2"};
