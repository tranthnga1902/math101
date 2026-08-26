import { useEffect, useRef, useState } from "react";
import katex from "katex";
import QRCode from "qrcode";
import { useReactToPrint } from "react-to-print";
import { type Worksheet } from "../api";

export function WorksheetPreview({sheet,onClose}:{sheet:Worksheet;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[codes,setCodes]=useState<Record<number,string>>({});
 useEffect(()=>{void Promise.all(sheet.items.map(async x=>[x.id,await QRCode.toDataURL(`${location.origin}/q/${x.qrSlug}`,{width:120,margin:1})] as const)).then(rows=>setCodes(Object.fromEntries(rows)))},[sheet]);
 const print=useReactToPrint({contentRef:ref,documentTitle:sheet.name});
 return <div className="dialog-backdrop"><section className="worksheet-dialog"><div className="panel-head no-print"><h2>Xem trước phiếu</h2><div><button onClick={onClose}>Đóng</button><button className="primary" onClick={()=>print()}>In / Xuất PDF</button></div></div><div ref={ref} className={`worksheet-page columns-${sheet.columnsCount}`}><header><h1>{sheet.name}</h1>{sheet.showStudentFields&&<p>Họ và tên: .................................................... &nbsp; Lớp: ....................</p>}</header><div className="worksheet-problems">{sheet.items.map((x,i)=><article key={x.id}><div><b>Câu {i+1}. <small>{x.publicCode}</small></b><span dangerouslySetInnerHTML={{__html:katex.renderToString(x.statementLatex.replace(/^\$|\$$/g,""),{throwOnError:false,displayMode:true})}}/></div>{sheet.showQr&&codes[x.id]&&<img src={codes[x.id]} alt={`QR câu ${i+1}`}/>}</article>)}</div></div></section></div>;
}
