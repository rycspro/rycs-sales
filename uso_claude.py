#!/usr/bin/env python3
"""Mostra quanto o Claude Code gastou nesta máquina, por projeto e por sessão.

Lê os históricos locais (~/.claude/projects e, no Mac, as sessões do Cowork)
e estima o custo em dólares "equivalente à API" para cada resposta.
Isso não é cobrança real no plano Pro/Max: serve para comparar o peso de cada
projeto e sessão no limite de uso.

Uso:
  python3 uso_claude.py                # últimos 7 dias
  python3 uso_claude.py --dias 30
  python3 uso_claude.py --desde 2026-11-17T18:00
"""
import argparse, collections, datetime, glob, json, os, socket

# US$ por milhão de tokens: entrada, saída, leitura de cache
PRECOS = {
    'claude-fable-5-2': (8, 40, 0.20), 'claude-fable-5-1': (10, 50, 1.0), 'claude-fable-5': (10, 50, 1.0),
    'claude-opus-5-5': (4, 20, 0.20), 'claude-opus-5': (5, 25, 0.5), 'claude-opus-4-8': (5, 25, 0.5),
    'claude-opus-4-7': (5, 25, 0.5), 'claude-opus-4-6': (5, 25, 0.5),
    'claude-sonnet-5-5': (2, 10, 0.10), 'claude-sonnet-5': (2, 10, 0.2), 'claude-sonnet-4-6': (3, 15, 0.3),
    'claude-haiku-5-5': (0.1, 0.5, 0.01), 'claude-haiku-4-5': (1, 5, 0.1),
}

def custo(modelo, u):
    p = PRECOS.get(modelo)
    if not p:
        return 0.0
    ent, sai, leit = p
    cc = u.get('cache_creation') or {}
    w1h = cc.get('ephemeral_1h_input_tokens', 0) or 0
    w5m = (u.get('cache_creation_input_tokens', 0) or 0) - w1h
    return ((u.get('input_tokens', 0) or 0) * ent + (u.get('output_tokens', 0) or 0) * sai
            + (u.get('cache_read_input_tokens', 0) or 0) * leit + w5m * ent * 1.25 + w1h * ent * 2) / 1e6

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dias', type=float, default=7)
    ap.add_argument('--desde', help='data/hora ISO em UTC, ex.: 2026-11-17T18:00')
    a = ap.parse_args()
    desde = a.desde or (datetime.datetime.utcnow() - datetime.timedelta(days=a.dias)).strftime('%Y-%m-%dT%H:%M')

    raizes = [os.path.expanduser('~/.claude/projects'),
              os.path.expanduser('~/Library/Application Support/Claude/local-agent-mode-sessions')]
    vistos, por_proj, por_modelo, desconhecidos = set(), collections.Counter(), collections.Counter(), collections.Counter()
    sessoes = collections.defaultdict(lambda: {'custo': 0.0, 'resp': 0, 'proj': '', 'arquivo': ''})
    for raiz in raizes:
        for f in glob.glob(raiz + '/**/*.jsonl', recursive=True):
            if f.endswith('audit.jsonl'):
                continue
            pasta = os.path.relpath(f, raiz).split(os.sep)[0]
            with open(f, errors='ignore') as fh:
                for linha in fh:
                    if '"usage"' not in linha:
                        continue
                    try:
                        d = json.loads(linha)
                    except ValueError:
                        continue
                    m = d.get('message') or {}
                    u = m.get('usage')
                    ts = d.get('timestamp', '')
                    if not isinstance(u, dict) or ts < desde:
                        continue
                    chave = (m.get('id'), d.get('requestId'))
                    if chave in vistos:
                        continue
                    vistos.add(chave)
                    proj = d.get('cwd') or pasta
                    modelo = m.get('model', '?')
                    c = custo(modelo, u)
                    if modelo not in PRECOS and modelo != '<synthetic>':
                        desconhecidos[modelo] += 1
                    sid = d.get('sessionId') or os.path.basename(f)[:-6]
                    s = sessoes[sid]
                    s['custo'] += c; s['resp'] += 1; s['proj'] = proj
                    if not s['arquivo'] and os.path.basename(f)[:-6] == sid:
                        s['arquivo'] = f
                    por_proj[proj] += c
                    por_modelo[modelo] += c

    def titulo(s):
        t = None
        if s['arquivo']:
            for linha in open(s['arquivo'], errors='ignore'):
                if '"custom-title"' in linha or '"ai-title"' in linha:
                    try:
                        d = json.loads(linha)
                        t = d.get('customTitle') or d.get('aiTitle') or t
                    except ValueError:
                        pass
        return t or '(sem título)'

    total = sum(por_proj.values())
    print(f'Máquina: {socket.gethostname()}   período: desde {desde} UTC')
    print(f'Total estimado: US$ {total:,.2f} (equivalente à API)\n')
    print('Por projeto:')
    for k, v in por_proj.most_common(10):
        print(f'  US$ {v:9,.2f}  {100 * v / total if total else 0:5.1f}%  {k}')
    print('\nPor modelo:')
    for k, v in por_modelo.most_common(8):
        print(f'  US$ {v:9,.2f}  {k}')
    print('\nSessões que mais gastaram:')
    for sid, s in sorted(sessoes.items(), key=lambda x: -x[1]['custo'])[:12]:
        print(f"  US$ {s['custo']:8,.2f}  {s['resp']:5d} resp  {titulo(s)}  [{os.path.basename(s['proj'])}]")
    if desconhecidos:
        print('\nModelos sem preço na tabela (contados como US$ 0):', dict(desconhecidos))

if __name__ == '__main__':
    main()
