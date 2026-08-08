#!/usr/bin/env python3
"""
Lightning Strike — placeholder / template sprite generator.

Emits spec-compliant PNG sprite sheets (+ JSON tag data) for every mech part and a
couple of monolithic enemies, per docs/art-spec.md. These serve two jobs:
  1) feed the Canvas renderer NOW (programmer-art placeholders), and
  2) act as Aseprite paint-over TEMPLATES — correct 64x64 frame, anchors, master
     palette, and animation tags — so an artist repaints instead of guessing.

All art uses ONLY the master palette so the engine's palette-swap (base/secondary/trim)
works. No anti-aliasing. Run:  python tools/gen_placeholders.py
"""
import json, os, struct, zlib
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

# ---- master palette (docs/art-spec.md §5); indices the renderer recolors: 1-3 base, 4-6 sec, 7-9 trim ----
MP = {
    "base_sh":(14,21,38), "base_mid":(22,35,63), "base_lt":(36,58,99),
    "sec_sh":(12,111,130), "sec_mid":(23,174,203), "sec_lt":(34,224,255),
    "trim_mid":(199,154,31), "trim_lt":(255,210,62), "glow":(255,255,255),
    "outline":(5,7,13), "metal_dk":(58,71,99), "metal_lt":(143,159,192),
}
FRAME = 64
TAGS_WEAPON = ["idle","act","hit","disabled"]
TAGS_PLAIN  = ["idle","act","hit","disabled"]
TAGS_CORE   = ["idle","act","hit","disabled","destroyed"]

# anchors (x,y) on the 64x64 canvas
A = {"head":(32,12),"core":(32,30),"rarm":(44,28),"larm":(20,28),"backpack":(32,20),"legs":(32,46)}
BASELINE = 62

def img(): return Image.new("RGBA",(FRAME,FRAME),(0,0,0,0))
def poly(d,pts,fill,outline=True):
    d.polygon(pts, fill=fill, outline=MP["outline"] if outline else None)
def rect(d,box,fill,outline=True):
    d.rectangle(box, fill=fill, outline=MP["outline"] if outline else None)

# ---------- part draw functions: draw ONE part's pixels on a transparent 64x64 frame ----------
def draw_head(d,tag,variant):
    if tag=="disabled":
        rect(d,(26,6,38,20),MP["metal_dk"]); return
    rect(d,(26,6,38,20),MP["base_mid"])
    rect(d,(27,7,37,12),MP["base_lt"],outline=False)
    d.rectangle((28,13,36,16), fill=MP["sec_lt"])          # visor (secondary)
    if variant=="owl": d.line((32,6,32,2), fill=MP["metal_lt"], width=1)  # antenna
    if variant=="optic": d.point((30,14), fill=MP["trim_lt"])

def draw_core(d,tag,variant):
    body = MP["metal_dk"] if tag=="disabled" else MP["base_mid"]
    pts=[(18,16),(46,16),(48,40),(40,50),(24,50),(16,40)]
    poly(d,pts,body)
    if tag!="disabled":
        poly(d,[(18,16),(46,16),(47,28),(17,28)],MP["base_lt"],outline=False)  # upper facet
        d.rectangle((26,22,38,32), fill=MP["sec_mid"])      # chest plate (secondary)
        core_c = MP["glow"] if tag in ("act","hit") else MP["trim_lt"]         # core light (trim/glow)
        d.ellipse((29,30,35,36), fill=core_c)
        if variant=="reactor":
            for vx in (20,42): d.rectangle((vx,34,vx+2,44), fill=MP["trim_mid"])
    if tag=="destroyed":
        d.line((18,18,46,48), fill=MP["trim_lt"], width=1); d.line((46,18,18,48), fill=MP["trim_lt"], width=1)

def _arm_base(d,side,tag):
    body = MP["metal_dk"] if tag=="disabled" else MP["base_mid"]
    if side==1:  # front / right arm
        poly(d,[(40,20),(50,22),(50,40),(42,40)],body)      # shoulder+upper
    else:        # back / left arm
        poly(d,[(24,20),(14,22),(14,40),(22,40)],body)

def draw_gun(d,tag,side,variant):
    _arm_base(d,side,tag)
    body = MP["metal_dk"] if tag=="disabled" else MP["metal_lt"]
    if side==1:
        rect(d,(44,30,62,38),body)                           # barrel forward
        if variant=="multi": rect(d,(44,26,60,30),body)      # second barrel (gatling)
        if variant=="box":   rect(d,(44,24,60,40),MP["base_lt"])  # missile box (missarm as rarm? rare)
        if tag=="act": d.ellipse((59,31,64,37), fill=MP["glow"])  # muzzle flash (trim/glow)
    else:
        rect(d,(2,26,20,40),MP["base_lt"] if variant=="box" else body)   # left-hand launcher/box
        if tag=="act": d.ellipse((0,30,5,36), fill=MP["glow"])

def draw_sword(d,tag,side,variant):
    _arm_base(d,side,tag)
    x = 46 if side==1 else 18
    if tag=="disabled":
        rect(d,(x-2,34,x+4,42),MP["metal_dk"]); return
    rect(d,(x-2,34,x+4,42),MP["metal_lt"])                    # hilt
    tip = (x+16,6) if side==1 else (x-16,6)
    blade_col = MP["glow"] if tag=="act" else MP["trim_lt"]
    poly(d,[(x-1,36),(x+3,36),tip],blade_col)                # energy blade (trim)

def draw_shield(d,tag,side,variant):
    _arm_base(d,side,tag)
    x = 6 if side==-1 else 44
    body = MP["metal_dk"] if tag=="disabled" else MP["sec_mid"]
    poly(d,[(x,14),(x+12,18),(x+14,32),(x+12,46),(x,42)] if side==-1
            else [(x+14,14),(x+2,18),(x,32),(x+2,46),(x+14,42)], body)
    if tag!="disabled":
        cx = x+7 if side==-1 else x+7
        d.rectangle((cx-2,28,cx+2,32), fill=MP["trim_lt"])   # emblem (trim)

def draw_fist(d,tag,side,variant):
    _arm_base(d,side,tag)
    x=46 if side==1 else 14
    rect(d,(x-3,36,x+3,42), MP["metal_dk"] if tag=="disabled" else MP["metal_lt"])

def draw_backpack(d,tag,variant):
    if tag=="disabled":
        rect(d,(26,14,38,24),MP["metal_dk"]); return
    if variant=="fins":
        poly(d,[(24,10),(20,24),(28,24)],MP["sec_mid"]); poly(d,[(40,10),(36,24),(44,24)],MP["sec_mid"])
        rect(d,(28,16,36,26),MP["base_mid"])
    elif variant=="thruster":                                 # FLY
        rect(d,(26,14,38,24),MP["base_mid"])
        for nx in (28,36): rect(d,(nx,24,nx+2,30),MP["metal_lt"])
        glow = MP["glow"] if tag=="act" else MP["trim_lt"]
        if tag=="act":
            for nx in (28,36): d.ellipse((nx-1,30,nx+3,34), fill=glow)
    elif variant=="jump":                                     # JUMP
        rect(d,(26,14,38,24),MP["base_mid"]); poly(d,[(30,24),(34,24),(32,32)],MP["trim_lt"])
    elif variant=="util":
        rect(d,(26,14,38,26),MP["base_mid"]); d.rectangle((29,17,35,21), fill=MP["sec_lt"])
    else:                                                     # box (missile pod)
        rect(d,(25,14,39,26),MP["base_mid"])
        for gy in (16,20):
            for gx in (27,31,35): d.rectangle((gx,gy,gx+2,gy+2), fill=MP["metal_dk"])

def draw_legs(d,tag,variant):
    body = MP["metal_dk"] if tag=="disabled" else MP["base_mid"]
    if variant=="tread":
        poly(d,[(16,40),(48,40),(52,54),(46,BASELINE),(18,BASELINE),(12,54)],body)
        if tag!="disabled":
            for wx in (20,32,44): d.ellipse((wx-3,50,wx+3,56), fill=MP["metal_dk"], outline=MP["outline"])
    elif variant=="hover":
        poly(d,[(18,42),(46,42),(48,50),(16,50)],body)        # skirt, gap under
        if tag!="disabled": d.rectangle((22,50,42,52), fill=MP["sec_lt"])  # jet glow (secondary)
    elif variant=="dive":
        rect(d,(26,40,30,56),body); rect(d,(34,40,38,56),body)
        poly(d,[(22,56),(30,56),(28,BASELINE),(20,BASELINE)],MP["sec_mid"])  # flipper
        poly(d,[(34,56),(42,56),(44,BASELINE),(36,BASELINE)],MP["sec_mid"])
    else:  # biped (sprint / spider)
        rect(d,(24,40,30,52),body); rect(d,(34,40,40,52),body)
        rect(d,(22,52,30,BASELINE),MP["base_lt"]); rect(d,(34,52,42,BASELINE),MP["base_lt"])  # feet

# ---------- part catalog: (slot,id,drawfn,variant) ----------
def arm(fn,variant): return ("arm",fn,variant)
PARTS = [
    ("head","hawkeye",draw_head,"fcs"), ("head","iris",draw_head,"optic"), ("head","owl",draw_head,"owl"),
    ("core","bastion",draw_core,"heavy"), ("core","runner",draw_core,"slim"), ("core","reactor",draw_core,"reactor"),
    ("rarm","vulcan",draw_gun,"single"), ("rarm","plasma",draw_sword,"blade"), ("rarm","gatling",draw_gun,"multi"),
    ("larm","saber",draw_sword,"blade"), ("larm","shieldarm",draw_shield,"shield"), ("larm","missarm",draw_gun,"box"),
    ("backpack","misspod",draw_backpack,"box"), ("backpack","shpack",draw_backpack,"fins"),
    ("backpack","repairpod",draw_backpack,"util"), ("backpack","fieldkit",draw_backpack,"util"),
    ("backpack","drone",draw_backpack,"util"), ("backpack","thrust",draw_backpack,"thruster"),
    ("backpack","jumpjet",draw_backpack,"jump"),
    ("legs","sprint",draw_legs,"biped"), ("legs","tread",draw_legs,"tread"), ("legs","spider",draw_legs,"biped"),
    ("legs","hover",draw_legs,"hover"), ("legs","dive",draw_legs,"dive"),
]
def tags_for(slot,fn):
    if slot=="core": return TAGS_CORE
    return TAGS_WEAPON

def draw_part(slot,fn,variant,tag):
    im=img(); d=ImageDraw.Draw(im)
    if slot in ("rarm","larm"):
        side = 1 if slot=="rarm" else -1
        fn(d,tag,side,variant)
    elif slot=="core": fn(d,tag,variant)
    elif slot=="head": fn(d,tag,variant)
    elif slot=="backpack": fn(d,tag,variant)
    elif slot=="legs": fn(d,tag,variant)
    return im

def emit_part(slot,pid,fn,variant):
    tags = tags_for(slot,fn)
    sheet = Image.new("RGBA",(FRAME*len(tags),FRAME),(0,0,0,0))
    tagmap={}
    for i,tag in enumerate(tags):
        sheet.paste(draw_part(slot,fn,variant,tag),(i*FRAME,0)); tagmap[tag]=i
    outdir=os.path.join(ASSETS,"mechs",slot); os.makedirs(outdir,exist_ok=True)
    sheet.save(os.path.join(outdir,pid+".png"))
    json.dump({"size":FRAME,"frames":len(tags),"tags":tagmap,"slot":slot,"id":pid},
              open(os.path.join(outdir,pid+".json"),"w"),indent=0)

# ---------- monolithic enemies (single sprite, hostile-ramp preview uses master ramp + engine swap) ----------
def emit_mono(pid,w,h,drawer):
    im=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(im); drawer(d,w,h)
    outdir=os.path.join(ASSETS,"enemies"); os.makedirs(outdir,exist_ok=True)
    im.save(os.path.join(outdir,pid+".png"))
    json.dump({"size":[w,h],"frames":1,"tags":{"idle":0},"id":pid,"mono":True},
              open(os.path.join(outdir,pid+".json"),"w"),indent=0)
def mono_bot(d,w,h):
    rect(d,(4,6,20,20),MP["base_mid"]); d.rectangle((7,9,17,13),fill=MP["sec_lt"]); rect(d,(9,20,15,23),MP["metal_dk"])
def mono_tank(d,w,h):
    poly(d,[(6,18,),(58,18),(60,34),(4,34)] if False else [(6,18),(58,18),(60,34),(4,34)],MP["base_mid"])
    rect(d,(8,34,56,44),MP["metal_dk"]); rect(d,(30,12,60,18),MP["base_lt"])  # turret + barrel
def mono_turret(d,w,h):
    rect(d,(10,24,38,44),MP["base_mid"]); poly(d,[(16,24),(32,24),(28,10),(20,10)],MP["metal_dk"])
    d.rectangle((22,14,26,20),fill=MP["sec_lt"])

# ---------- reference skeleton template + palette ----------
def emit_skeleton():
    im=Image.new("RGBA",(FRAME,FRAME),(0,0,0,0)); d=ImageDraw.Draw(im)
    for x in range(0,FRAME,8): d.line((x,0,x,FRAME),fill=(40,60,100,80))
    for y in range(0,FRAME,8): d.line((0,y,FRAME,y),fill=(40,60,100,80))
    d.line((0,BASELINE,FRAME,BASELINE),fill=(255,210,62,160))
    for name,(ax,ay) in A.items():
        d.ellipse((ax-2,ay-2,ax+2,ay+2),outline=(34,224,255,220))
    outdir=os.path.join(ASSETS,"_reference"); os.makedirs(outdir,exist_ok=True)
    im.save(os.path.join(outdir,"skeleton.png"))
def emit_palette():
    order=["outline","base_sh","base_mid","base_lt","sec_sh","sec_mid","sec_lt",
           "trim_mid","trim_lt","glow","metal_dk","metal_lt"]
    lines=["GIMP Palette","Name: LightningStrike-Master","Columns: 4","#"]
    for k in order:
        r,g,b=MP[k]; lines.append(f"{r:3d} {g:3d} {b:3d}\t{k}")
    os.makedirs(ASSETS,exist_ok=True)
    open(os.path.join(ASSETS,"palette.gpl"),"w").write("\n".join(lines)+"\n")

def emit_sprites_js():
    """Bundle every sheet as a data: URI into assets/sprites.js (window.SPRITES) so the
    renderer works on file:// without fetch-CORS or canvas-taint blocking palette-swap."""
    import base64
    spr={}
    def add(key,pngpath,meta):
        b=open(pngpath,"rb").read()
        spr[key]={**meta,"uri":"data:image/png;base64,"+base64.b64encode(b).decode()}
    for slot,pid,fn,variant in PARTS:
        meta=json.load(open(os.path.join(ASSETS,"mechs",slot,pid+".json")))
        add(f"{slot}/{pid}",os.path.join(ASSETS,"mechs",slot,pid+".png"),meta)
    for pid in ("bot","tank","turret"):
        meta=json.load(open(os.path.join(ASSETS,"enemies",pid+".json")))
        add(f"mono/{pid}",os.path.join(ASSETS,"enemies",pid+".png"),meta)
    js="window.SPRITES="+json.dumps(spr)+";\nwindow.MASTER_PALETTE="+\
       json.dumps({k:"#%02x%02x%02x"%v for k,v in MP.items()})+";\n"
    open(os.path.join(ASSETS,"sprites.js"),"w").write(js)

def main():
    emit_palette(); emit_skeleton()
    for slot,pid,fn,variant in PARTS: emit_part(slot,pid,fn,variant)
    emit_mono("bot",24,24,mono_bot); emit_mono("tank",64,48,mono_tank); emit_mono("turret",48,48,mono_turret)
    n=len(PARTS)+3
    man={"parts":[{"slot":s,"id":i} for s,i,_,_ in PARTS],
         "enemiesMono":["bot","tank","turret"],"frame":FRAME,
         "palette":{k:"#%02x%02x%02x"%v for k,v in MP.items()}}
    json.dump(man,open(os.path.join(ASSETS,"manifest.json"),"w"),indent=2)
    emit_sprites_js()
    print(f"generated {n} sprites + palette + skeleton + manifest + sprites.js into {ASSETS}")

if __name__=="__main__": main()
