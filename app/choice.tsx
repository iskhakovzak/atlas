'use client';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';

// Apart from app/market-ui.tsx so pages without a dropdown do not load Radix Select and its positioning code.
export function Choice({value,onChange,options,label,disabled=false,className=''}:{value:string;onChange:(v:string)=>void;options:string[];label:string;disabled?:boolean;className?:string}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className={`select-control ${className}`.trim()}><SelectValue>{value}</SelectValue></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>}
