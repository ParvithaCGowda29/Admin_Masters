export function parseCSV(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++) {const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else if(quoted){quoted=false}else if(cell===''){quoted=true}else throw Error('Invalid quote in CSV');}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c;}
 if(quoted)throw Error('Unclosed quote in CSV');
 if(cell||row.length){row.push(cell);rows.push(row)}
 return rows;
}
export function toCSV(rows:string[][]){return '\uFEFF'+rows.map(r=>r.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n')}
