from playwright.sync_api import sync_playwright
def card(pg): return pg.inner_text('#tip').replace('\n',' | ') if pg.is_visible('#tip') else '(no card)'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':950}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('https://claude.ai/artifact/DDQxmSr7xK3qtxQRkKCd21') if False else pg.goto('file://'+__import__('os').path.abspath('dist/hearth-sim.html')+''); pg.wait_for_timeout(1200)
    box=pg.query_selector('#map').bounding_box()
    cell=lambda lx,ly:(box['x']+(lx+.5)*box['width']/28, box['y']+(ly+.5)*box['height']/20)
    for toolkey,label in [('i','Inspect'),('c','Camp site'),('f','Light'),('p','Poke')]:
        pg.evaluate("newWorld('validate-1')"); pg.evaluate("paused=true"); pg.keyboard.press(toolkey)
        pg.evaluate("for(let i=0;i<200;i++)step()")  # settler picks the site
        lx,ly=pg.evaluate("[camp.site[0]-cur.sx*LW, camp.site[1]-cur.sy*LH]")
        pg.mouse.move(*cell(lx+2,ly)); pg.mouse.move(*cell(lx,ly)); pg.wait_for_timeout(250)
        s1=card(pg)
        pg.evaluate("let n=0; while(!camp.pit && n<30000){step(); n++}"); pg.wait_for_timeout(350)
        s2=card(pg)
        pg.evaluate("lightTile(...camp.pit)"); pg.wait_for_timeout(350)
        s3=card(pg)
        ok = 'Camp site' in s1 and 'Still needed' in s1 and 'waiting for fire' in s2 and 'burning' in s3
        print(f"{label:10} {'PASS' if ok else 'FAIL'}")
        print('   marked :', s1[:150]); print('   built  :', s2[:150]); print('   lit    :', s3[:150])
        if toolkey=='f': pg.screenshot(path='val.png')
    print('errors', errs); b.close()
