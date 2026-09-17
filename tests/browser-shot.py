from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':1000}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://'+__import__('os').path.abspath('dist/hearth-sim.html')+''); pg.wait_for_timeout(1200)
    pg.evaluate("newWorld('q'); paused=true; for(let i=0;i<40500;i++){step(); for(const c of camps){ if(c.pit&&!c.everLit&&c.coals<=tick) lightTile(...c.pit);} } weather.storm=true; weather.until=tick+300; renderUI(true)")
    pg.wait_for_timeout(600)
    print('camps', pg.evaluate("camps.map(c=>c.name)"), pg.inner_text('#clock'))
    pg.screenshot(path='v3a.png')
    n=pg.evaluate("document.querySelectorAll('#camps [data-camp]').length")
    if n>1:
        pg.click('#camps [data-camp]:nth-child(2)'); pg.wait_for_timeout(500); print('switched to', pg.inner_text('#where'))
    box=pg.query_selector('#map').bounding_box()
    d=pg.evaluate("(()=>{const b=beings.find(b=>b.alive&&b.species!=='human'&&secOf(b.x,b.y).sx===cur.sx&&secOf(b.x,b.y).sy===cur.sy); return b?[b.x-cur.sx*LW,b.y-cur.sy*LH,b.species]:null})()")
    if d: pg.mouse.move(box['x']+(d[0]+.5)*box['width']/28, box['y']+(d[1]+.5)*box['height']/20); pg.wait_for_timeout(300); print('mob card:', pg.inner_text('#tip').replace('\n',' | ')[:200])
    pg.screenshot(path='v3b.png')
    print('errors', errs); b.close()
