import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

export interface ProxiedImage {
  buffer: Buffer;
  contentType: string;
}

/**
 * Scarica un'immagine da un URL esterno per conto del frontend, aggirando
 * i limiti CORS che renderebbero il canvas "tainted".
 */
@Injectable()
export class ImageProxyService {
  async fetchImage(rawUrl: string | undefined): Promise<ProxiedImage> {
    const target = this.validateUrl(rawUrl);

    let response: Response;
    try {
      response = await fetch(target, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'follow',
        headers: {
          accept: 'image/*',
          // Diversi CDN (es. Wikimedia) rifiutano richieste senza User-Agent
          'user-agent': 'crosstitch-image-proxy/1.0',
        },
      });
    } catch {
      throw new BadGatewayException('Immagine non raggiungibile.');
    }

    // I redirect vengono seguiti: riverifica l'host di destinazione finale.
    this.validateUrl(response.url);

    if (!response.ok) {
      throw new BadGatewayException(
        `Il server remoto ha risposto ${response.status}.`,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException('L’URL non restituisce un’immagine.');
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Immagine troppo grande (massimo 20 MB).');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Immagine troppo grande (massimo 20 MB).');
    }

    return { buffer, contentType };
  }

  private validateUrl(rawUrl: string | undefined): URL {
    if (!rawUrl) {
      throw new BadRequestException('Parametro "url" mancante.');
    }
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException('URL non valido.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('Sono supportati solo URL http(s).');
    }
    if (this.isForbiddenHost(url.hostname)) {
      throw new BadRequestException('Host non consentito.');
    }
    return url;
  }

  /**
   * Blocco anti-SSRF di base: loopback, link-local e reti private.
   * (Non copre il DNS rebinding: accettabile per un'app interna.)
   */
  private isForbiddenHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '0.0.0.0'
    ) {
      return true;
    }
    // IPv6: loopback, unique-local (fc00::/7), link-local (fe80::/10)
    if (host.includes(':')) {
      return (
        host === '::1' ||
        host === '::' ||
        host.startsWith('fc') ||
        host.startsWith('fd') ||
        host.startsWith('fe8') ||
        host.startsWith('fe9') ||
        host.startsWith('fea') ||
        host.startsWith('feb')
      );
    }
    // IPv4 letterale: loopback e reti private/link-local
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
      return (
        a === 127 ||
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254)
      );
    }
    return false;
  }
}
