const fs=require("fs"),path=require("path");
const src=fs.readFileSync("src/contexts/LocaleContext.jsx","utf8");
const a=src.indexOf("const translations = ");
const b=src.slice(a).search(/\r?\n\};/)+a+3;
const tr=eval("("+src.slice(a+"const translations = ".length,b).replace(/;$/,"")+")");
const vi={};
function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(p.endsWith(".jsx")){const s=fs.readFileSync(p,"utf8");for(const m of s.matchAll(/\bt\(\s*"(\w+)"\s*,\s*("(?:[^"\\]|\\.)*"|`[^`]*`)/g)){try{vi[m[1]]=vi[m[1]]??eval(m[2])}catch{}}}}}
walk("src");
tr.vi=vi;
for(const [l,o] of Object.entries(tr)){fs.mkdirSync(`src/locales/${l}`,{recursive:true});fs.writeFileSync(`src/locales/${l}/common.json`,JSON.stringify(o,null,2)+"\n")}
console.log(Object.keys(vi).length, Object.keys(tr.en).length, Object.keys(tr.en).filter(k=>!(k in vi)))

