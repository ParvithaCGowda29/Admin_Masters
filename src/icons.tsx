// BuLLM icon library (files.instinct.com/nvazx4ywbxu3-bullm-icon-library): stroke 1.5, round caps, 24 viewBox.
// IconUpload and IconStack2 are extracted verbatim from the library. The library ships no folder or archive
// glyph, so IconFolder and IconArchive are drawn in the same line-icon style.
type IconProps={size?:number};
const base=(size=18)=>({width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const});
export function IconUpload({size}:IconProps){return <svg {...base(size)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 9l5 -5l5 5"/><path d="M12 4l0 12"/></svg>}
export function IconStack2({size}:IconProps){return <svg {...base(size)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 4l-8 4l8 4l8 -4l-8 -4"/><path d="M4 12l8 4l8 -4"/><path d="M4 16l8 4l8 -4"/></svg>}
export function IconFolder({size}:IconProps){return <svg {...base(size)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"/></svg>}
export function IconArchive({size}:IconProps){return <svg {...base(size)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10"/><path d="M10 12l4 0"/></svg>}
