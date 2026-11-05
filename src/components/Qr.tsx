/** qrSvg() で生成した SVG を表示する。 */
export function Qr({ svg, className }: { svg: string; className: string }) {
  return <div className={`${className} [&_svg]:h-full [&_svg]:w-full`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
