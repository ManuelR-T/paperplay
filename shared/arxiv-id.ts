const ID_PATTERN = /^(?:\d{4}\.\d{4,5}|[a-z][a-z.-]*(?:\.[A-Z]{2})?\/\d{7})(?:v[1-9]\d{0,2})?$/;

export function parseArxivId(value: string): string {
  let id = value.trim().replace(/^arxiv\s*:\s*/i, '');
  if (/^https?:\/\//i.test(id)) {
    const url = new URL(id);
    if (url.protocol !== 'https:' || url.hostname !== 'arxiv.org' || url.port || url.username || url.password) throw new Error('Use an HTTPS arxiv.org paper URL or an arXiv identifier.');
    const match = url.pathname.match(/^\/(?:abs|pdf|html)\/(.+?)\/?$/);
    if (!match) throw new Error('Use an arXiv /abs/, /pdf/ or /html/ paper link.');
    id = decodeURIComponent(match[1]).replace(/\.pdf$/i, '');
  }
  const date = id.includes('/') ? id.split('/')[1].slice(0, 4) : id.slice(0, 4);
  if (!ID_PATTERN.test(id) || Number(date.slice(2, 4)) < 1 || Number(date.slice(2, 4)) > 12) throw new Error('Invalid arXiv identifier. Use a paper ID such as 1805.04154v1.');
  return id;
}
