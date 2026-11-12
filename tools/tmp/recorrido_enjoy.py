"""Recorrido headed con los usuarios de Male y Dani: menú disponible, cada pantalla y pestañas de un evento Enjoy."""
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.dirname(os.path.abspath(__file__))
PASSWORD = 'Enjoy2026!'
USUARIOS = [
    ('male', 'envios.enjoyproducciones@gmail.com'),
    ('dani', 'danielyanello93@gmail.com'),
]
PAUSA = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0

resultado = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, slow_mo=150, args=['--start-maximized'])
    for alias, email in USUARIOS:
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = ctx.new_page()
        page.goto(BASE + '/login')
        page.fill('input[type=email]', email)
        page.fill('input[type=password]', PASSWORD)
        page.click('button[type=submit]')
        page.wait_for_load_state('networkidle')
        time.sleep(PAUSA)
        info = {'home': page.url.replace(BASE, '')}
        if '/cambiar-password' in page.url or '/login' in page.url:
            info['error'] = 'no pudo entrar: ' + page.url
            resultado[alias] = info
            ctx.close()
            continue
        if '/seleccionar-empresa' in page.url:
            page.get_by_text('Enjoy', exact=False).first.click()
            page.wait_for_load_state('networkidle')

        # Menú: grupos y links del sidebar
        nav = page.locator('nav[aria-label="Navegación principal"]')
        grupos = []
        for g in nav.locator(':scope > div').all():
            titulo = g.locator('button').first.inner_text().strip() if g.locator('button').count() else ''
            links = [{'label': a.inner_text().strip().split('\n')[0], 'to': a.get_attribute('href')} for a in g.locator('a').all()]
            if not links:
                links = [{'label': a.inner_text().strip().split('\n')[0], 'to': a.get_attribute('href')} for a in nav.locator('a').all()]
            grupos.append({'grupo': titulo, 'items': links})
        info['menu'] = grupos
        page.screenshot(path=os.path.join(OUT, f'{alias}_home.png'))

        # Recorrer cada pantalla del menú
        pantallas = []
        for g in grupos:
            for it in g['items']:
                page.goto(BASE + it['to'])
                page.wait_for_load_state('networkidle')
                time.sleep(PAUSA)
                h1 = page.locator('main h1, h1').first
                titulo = h1.inner_text().strip() if h1.count() else ''
                tabs = [t.inner_text().strip() for t in page.locator('[role=tab]').all()]
                vacio = page.get_by_text('No hay', exact=False).count() > 0
                pantallas.append({'to': it['to'], 'titulo': titulo, 'tabs': tabs, 'mensaje_vacio': vacio,
                                  'url_final': page.url.replace(BASE, '')})
        info['pantallas'] = pantallas

        # Un evento de Enjoy: pestañas que ve
        page.goto(BASE + '/eventos')
        page.wait_for_load_state('networkidle')
        link = page.locator('a[href^="/eventos/"]').first
        if link.count():
            link.click()
            page.wait_for_load_state('networkidle')
            time.sleep(PAUSA)
            info['evento_url'] = page.url.replace(BASE, '')
            info['evento_tabs'] = [t.inner_text().strip() for t in page.locator('[role=tab], a[href*="/eventos/"][class*="tab"]').all()]
            page.screenshot(path=os.path.join(OUT, f'{alias}_evento.png'), full_page=False)
        resultado[alias] = info
        ctx.close()
    browser.close()

with open(os.path.join(OUT, 'recorrido_enjoy.json'), 'w', encoding='utf-8') as f:
    json.dump(resultado, f, ensure_ascii=False, indent=2)
print('ok')
