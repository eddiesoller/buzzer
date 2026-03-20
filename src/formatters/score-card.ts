import sharp from 'sharp';
import { ScoreCardContext, GameCardContext, PlayerCardContext, PlayCardContext } from '../types/score-card.js';
import { AlertPriority } from '../types/alert.js';
import { Team } from '../types/game.js';

const W = 1200;
const H = 675;

const BG_TOP = '#0d1b2a';
const BG_BOT = '#1a2744';
const SURFACE = '#162032';
const WHITE = '#ffffff';
const MUTED = '#64748b';
const LIGHT = '#cbd5e1';

/** Accent color drives all urgency-related decoration */
const ACCENT: Record<AlertPriority, string> = {
  high:   '#ef4444', // red   — urgent
  medium: '#f97316', // orange — notable
  low:    '#38bdf8', // sky   — informational
};

function accentFor(priority: AlertPriority): string {
  return ACCENT[priority];
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function periodStr(period: number, status: string): string {
  if (status === 'post') return 'FINAL';
  if (period === 1) return '1ST HALF';
  if (period === 2) return '2ND HALF';
  return period === 3 ? 'OT' : `${period - 2}OT`;
}

function defs(accent: string): string {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG_TOP}"/>
      <stop offset="100%" stop-color="${BG_BOT}"/>
    </linearGradient>
    <linearGradient id="div" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0"/>
      <stop offset="25%"  stop-color="${accent}" stop-opacity="0.6"/>
      <stop offset="75%"  stop-color="${accent}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>`;
}

/** Pill badge centered at the top — font and pill size scale with priority */
function labelPill(label: string, accent: string, priority: AlertPriority, pillY = 24): string {
  const fontSize = priority === 'high' ? 30 : priority === 'medium' ? 27 : 25;
  const pillH = priority === 'high' ? 62 : 56;
  const pillW = Math.max(260, label.length * (fontSize * 0.72) + 90);
  const pillX = W / 2 - pillW / 2;
  const cy = pillY + pillH / 2;
  // High-priority: bright white text on red for max contrast
  const textColor = WHITE;
  return `
    <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${accent}"/>
    <text x="${W / 2}" y="${cy}" font-family="Noto Sans, sans-serif" font-size="${fontSize}" font-weight="800"
      fill="${textColor}" text-anchor="middle" dominant-baseline="middle" letter-spacing="3">${esc(label)}</text>
  `;
}

async function fetchLogoAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    const ct = res.headers.get('content-type') ?? 'image/png';
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

async function fetchTeamLogos(away: Team, home: Team): Promise<{ away: string | null; home: string | null }> {
  const [awayLogo, homeLogo] = await Promise.all([
    away.logo ? fetchLogoAsDataUri(away.logo) : Promise.resolve(null),
    home.logo ? fetchLogoAsDataUri(home.logo) : Promise.resolve(null),
  ]);
  return { away: awayLogo, home: homeLogo };
}

/** Seed circle badge */
function seedBadge(seed: number | undefined, cx: number, cy: number, accent: string, logoDataUri?: string | null, clipId?: string): string {
  if (seed == null && !logoDataUri) return '';

  if (logoDataUri && clipId) {
    const overlayCx = cx + 24;
    const overlayCy = cy + 28;
    const fs = seed != null && seed >= 10 ? 13 : 16;
    return `
      <clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="38"/></clipPath>
      <image href="${logoDataUri}" x="${cx - 38}" y="${cy - 38}" width="76" height="76" clip-path="url(#${clipId})"/>
      ${seed != null ? `
      <circle cx="${overlayCx}" cy="${overlayCy}" r="18" fill="${accent}"/>
      <text x="${overlayCx}" y="${overlayCy}" font-family="Noto Sans, sans-serif" font-size="${fs}" font-weight="800"
        fill="${WHITE}" text-anchor="middle" dominant-baseline="middle">${seed}</text>
      ` : ''}
    `;
  }

  if (seed == null) return '';
  const fs = seed >= 10 ? 20 : 24;
  return `
    <circle cx="${cx}" cy="${cy}" r="28" fill="${accent}"/>
    <text x="${cx}" y="${cy}" font-family="Noto Sans, sans-serif" font-size="${fs}" font-weight="800"
      fill="${WHITE}" text-anchor="middle" dominant-baseline="middle">${seed}</text>
  `;
}

/**
 * One team row: seed badge | team name + record | score
 * Leading team's score renders in the accent color.
 */
function teamRow(team: Team, score: number, yMid: number, isLeading: boolean, accent: string, logoDataUri?: string | null, side?: 'away' | 'home'): string {
  const hasLogo = !!logoDataUri;
  const leftPad = hasLogo ? 160 : team.seed != null ? 140 : 80;
  const scoreColor = isLeading ? accent : WHITE;
  const recordY = yMid + 38;
  const nameFontSize = team.shortName.length > 14 ? 50 : team.shortName.length > 10 ? 56 : 64;
  const clipId = `logo-clip-${side ?? 'team'}`;

  return `
    ${seedBadge(team.seed, 68, yMid, accent, logoDataUri, clipId)}
    <text x="${leftPad}" y="${yMid}" font-family="Noto Sans, sans-serif" font-size="${nameFontSize}" font-weight="800"
      fill="${WHITE}" dominant-baseline="middle">${esc(team.shortName)}</text>
    ${team.record ? `
    <text x="${leftPad}" y="${recordY}" font-family="Noto Sans, sans-serif" font-size="24"
      fill="${MUTED}" dominant-baseline="hanging">${esc(team.record)}</text>` : ''}
    <text x="${W - 72}" y="${yMid}" font-family="Noto Sans, sans-serif" font-size="104" font-weight="800"
      fill="${scoreColor}" text-anchor="end" dominant-baseline="middle">${score}</text>
  `;
}

function gradientDivider(y: number): string {
  return `<rect x="60" y="${y}" width="${W - 120}" height="2" fill="url(#div)"/>`;
}

function footer(text: string, accent: string): string {
  return `
    <rect x="0" y="${H - 86}" width="${W}" height="86" fill="${SURFACE}"/>
    <rect x="0" y="${H - 86}" width="${W}" height="2" fill="${accent}" fill-opacity="0.5"/>
    <text x="${W / 2}" y="${H - 43}" font-family="Noto Sans, sans-serif" font-size="30" font-weight="600"
      fill="${MUTED}" text-anchor="middle" dominant-baseline="middle" letter-spacing="1.5">${esc(text)}</text>
  `;
}

// ---------------------------------------------------------------------------
// Game card
// ---------------------------------------------------------------------------

function buildGameSvg(ctx: GameCardContext, logos: { away: string | null; home: string | null }): string {
  const { awayTeam, homeTeam, period, clock, status, label, priority } = ctx;
  const accent = accentFor(priority);
  const periodLabel = periodStr(period, status);
  const clockStr = status === 'post' ? '' : `  ·  ${clock}`;
  const awayLeads = awayTeam.score > homeTeam.score;
  const homeLeads = homeTeam.score > awayTeam.score;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${defs(accent)}
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${W}" height="6" fill="${accent}"/>

    ${labelPill(label, accent, priority)}

    ${teamRow(awayTeam, awayTeam.score, 238, awayLeads, accent, logos.away, 'away')}
    ${gradientDivider(342)}
    ${teamRow(homeTeam, homeTeam.score, 452, homeLeads, accent, logos.home, 'home')}

    ${footer(periodLabel + clockStr, accent)}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Player card
// ---------------------------------------------------------------------------

interface ParsedStat { value: string; label: string }

function parseStatLine(statLine: string): ParsedStat[] | null {
  const parts = statLine.trim().split(/\s{2,}/);
  if (parts.length < 2) return null;
  const parsed = parts.map(p => {
    const m = p.trim().match(/^(\S+)\s+(\S+)$/);
    return m ? { value: m[1], label: m[2] } : null;
  });
  if (parsed.some(p => p === null)) return null;
  return parsed as ParsedStat[];
}

function statBoxes(stats: ParsedStat[], accent: string, boxY = 308): string {
  const gap = 28;
  const available = W - 120;
  const boxW = Math.min(260, (available - gap * (stats.length - 1)) / stats.length);
  const boxH = 148;
  const totalW = stats.length * boxW + (stats.length - 1) * gap;
  const startX = (W - totalW) / 2;
  const valueFontSize = boxW >= 210 ? 64 : boxW >= 170 ? 52 : 42;

  return stats.map((stat, i) => {
    const x = startX + i * (boxW + gap);
    const cx = x + boxW / 2;
    return `
      <rect x="${x}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="${SURFACE}"/>
      <rect x="${x}" y="${boxY}" width="${boxW}" height="4" rx="2" fill="${accent}" fill-opacity="0.7"/>
      <text x="${cx}" y="${boxY + boxH * 0.44}" font-family="Noto Sans, sans-serif" font-size="${valueFontSize}" font-weight="800"
        fill="${WHITE}" text-anchor="middle" dominant-baseline="middle">${esc(stat.value)}</text>
      <text x="${cx}" y="${boxY + boxH * 0.82}" font-family="Noto Sans, sans-serif" font-size="23" font-weight="700"
        fill="${MUTED}" text-anchor="middle" dominant-baseline="middle" letter-spacing="2">${esc(stat.label)}</text>
    `;
  }).join('');
}

function buildPlayerSvg(ctx: PlayerCardContext, playerLogo: string | null): string {
  const { playerName, teamName, statLine, awayTeam, homeTeam, period, clock, status, priority } = ctx;
  const accent = accentFor(priority);
  const periodLabel = periodStr(period, status);
  const clockStr = status === 'post' ? '' : `  ·  ${clock}`;
  const scoreStr = `${awayTeam.abbreviation} ${awayTeam.score}  —  ${homeTeam.abbreviation} ${homeTeam.score}`;

  const nameFontSize = playerName.length > 20 ? 60 : playerName.length > 15 ? 70 : 82;
  const stats = parseStatLine(statLine);

  // All vertical positions are derived from nameY so top/bottom padding are equal.
  // Offsets from nameY (measured from the original fixed layout):
  //   underline +46, logo +92, teamName +84/158, statBox +130/190, scoreLine +338/370
  // Equal padding: nameY - nameFontHalf = footerY - (nameY + scoreOffset + scoreFontHalf)
  // => nameY = (footerY + nameFontHalf - scoreOffset - scoreFontHalf) / 2
  const nameFontHalf = nameFontSize / 2;
  const scoreOffset = playerLogo ? 370 : 338;
  const footerY = H - 86;
  const nameY = Math.round((footerY + nameFontHalf - scoreOffset - 16) / 2);

  const underlineY = nameY + 46;
  const logoCy     = nameY + 92;
  const teamNameY  = nameY + (playerLogo ? 158 : 84);
  const statBoxY   = nameY + (playerLogo ? 190 : 130);
  const scoreLineY = nameY + scoreOffset;

  const statsContent = stats
    ? statBoxes(stats, accent, statBoxY)
    : `
      <rect x="120" y="${statBoxY}" width="${W - 240}" height="144" rx="14" fill="${SURFACE}"/>
      <rect x="120" y="${statBoxY}" width="${W - 240}" height="4" rx="2" fill="${accent}" fill-opacity="0.7"/>
      <text x="${W / 2}" y="${statBoxY + 72}" font-family="Noto Sans, sans-serif" font-size="52" font-weight="700"
        fill="${WHITE}" text-anchor="middle" dominant-baseline="middle" letter-spacing="4">${esc(statLine)}</text>
    `;

  const logoSvg = playerLogo ? `
    <clipPath id="player-logo-clip"><circle cx="${W / 2}" cy="${logoCy}" r="38"/></clipPath>
    <image href="${playerLogo}" x="${W / 2 - 38}" y="${logoCy - 38}" width="76" height="76" clip-path="url(#player-logo-clip)"/>
  ` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${defs(accent)}
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${W}" height="6" fill="${accent}"/>

    <!-- Player name -->
    <text x="${W / 2}" y="${nameY}" font-family="Noto Sans, sans-serif" font-size="${nameFontSize}" font-weight="800"
      fill="${WHITE}" text-anchor="middle" dominant-baseline="middle">${esc(playerName)}</text>

    <!-- Accent underline -->
    <rect x="${W / 2 - 120}" y="${underlineY}" width="240" height="5" rx="2.5" fill="${accent}"/>

    <!-- Team logo (centered, above team name) -->
    ${logoSvg}

    <!-- Team name -->
    <text x="${W / 2}" y="${teamNameY}" font-family="Noto Sans, sans-serif" font-size="30" font-weight="500"
      fill="${MUTED}" text-anchor="middle" dominant-baseline="middle" letter-spacing="1">${esc(teamName)}</text>

    <!-- Stat boxes -->
    ${statsContent}

    <!-- Score line -->
    <text x="${W / 2}" y="${scoreLineY}" font-family="Noto Sans, sans-serif" font-size="32" font-weight="500"
      fill="${LIGHT}" text-anchor="middle" dominant-baseline="middle" letter-spacing="1">${esc(scoreStr)}</text>

    ${footer(periodLabel + clockStr, accent)}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Play card
// ---------------------------------------------------------------------------

function buildPlaySvg(ctx: PlayCardContext, logos: { away: string | null; home: string | null }): string {
  const { awayTeam, homeTeam, awayScore, homeScore, period, clock, label, playerName, priority } = ctx;
  const accent = accentFor(priority);
  const periodLabel = periodStr(period, 'in');
  const clockStr = clock ? `  ·  ${clock}` : '';
  const awayLeads = awayScore > homeScore;
  const homeLeads = homeScore > awayScore;

  const awayY = playerName ? 272 : 238;
  const divY  = playerName ? 368 : 342;
  const homeY = playerName ? 462 : 452;

  const awayDisplay: Team = { ...awayTeam, score: awayScore };
  const homeDisplay: Team = { ...homeTeam, score: homeScore };

  const playerFontSize = playerName && playerName.length > 20 ? 36 : 44;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${defs(accent)}
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${W}" height="6" fill="${accent}"/>

    ${labelPill(label, accent, priority)}

    ${playerName ? `<text x="${W / 2}" y="158" font-family="Noto Sans, sans-serif" font-size="${playerFontSize}" font-weight="600"
      fill="${LIGHT}" text-anchor="middle" dominant-baseline="middle">${esc(playerName)}</text>` : ''}

    ${teamRow(awayDisplay, awayScore, awayY, awayLeads, accent, logos.away, 'away')}
    ${gradientDivider(divY)}
    ${teamRow(homeDisplay, homeScore, homeY, homeLeads, accent, logos.home, 'home')}

    ${footer(periodLabel + clockStr, accent)}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateScoreCard(context: ScoreCardContext): Promise<Buffer> {
  let svg: string;
  switch (context.kind) {
    case 'game': {
      const logos = await fetchTeamLogos(context.awayTeam, context.homeTeam);
      svg = buildGameSvg(context, logos);
      break;
    }
    case 'player': {
      const playerLogo = context.playerTeam.logo
        ? await fetchLogoAsDataUri(context.playerTeam.logo)
        : null;
      svg = buildPlayerSvg(context, playerLogo);
      break;
    }
    case 'play': {
      const logos = await fetchTeamLogos(context.awayTeam, context.homeTeam);
      svg = buildPlaySvg(context, logos);
      break;
    }
  }
  return sharp(Buffer.from(svg)).png().toBuffer();
}
