"""Blender scene: open book on a pastel surface with soft leaf shadows, pages that bend
as they turn (right-to-left book: pages flip from left to right), cinematic camera with
shallow depth of field ending on a macro of the page.

Run:  blender -b -P book_scene.py -- --out <dir> [--frames 1,60,150] [--samples 32] [--res 720x1280]
"""
import bpy, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg("--out", "/tmp/render")
FRAMES = arg("--frames", "")
SAMPLES = int(arg("--samples", "32"))
RW, RH = map(int, arg("--res", "720x1280").split("x"))
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "tex")

FPS, N = 24, 216                     # 9 seconds
PW, PH = 0.20, 0.28                  # page size (m)
STACK = 0.012                        # page block thickness per side

# ---------------- reset ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = False      # distro build has no OIDN; denoise in post (ffmpeg)
sc.cycles.max_bounces = 4
sc.render.resolution_x, sc.render.resolution_y = RW, RH
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, N
_vt = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "AgX" if "AgX" in _vt else ("Filmic" if "Filmic" in _vt else "Standard")
sc.view_settings.exposure = -0.2
sc.view_settings.look = "None"

def img(name):
    return bpy.data.images.load(os.path.join(TEX, name), check_existing=True)

def mat_diffuse(name, rgb, rough=0.8):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m

def mat_image(name, image_name, back_image=None, flip_back=True):
    """Paper material; optional different image on the back face (UV mirrored)."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nodes, links = nt.nodes, nt.links
    bsdf = nodes["Principled BSDF"]; bsdf.inputs["Roughness"].default_value = 0.75
    try:
        bsdf.inputs["Subsurface Weight"].default_value = 0.05
    except KeyError:
        pass
    front = nodes.new("ShaderNodeTexImage"); front.image = img(image_name)
    if back_image:
        back = nodes.new("ShaderNodeTexImage"); back.image = img(back_image)
        uv = nodes.new("ShaderNodeTexCoord"); sep = nodes.new("ShaderNodeSeparateXYZ"); comb = nodes.new("ShaderNodeCombineXYZ")
        inv = nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
        links.new(uv.outputs["UV"], sep.inputs[0]); links.new(sep.outputs["X"], inv.inputs[1])
        links.new(inv.outputs[0] if flip_back else sep.outputs["X"], comb.inputs["X"]); links.new(sep.outputs["Y"], comb.inputs["Y"])
        links.new(comb.outputs[0], back.inputs["Vector"])
        geo = nodes.new("ShaderNodeNewGeometry"); mix = nodes.new("ShaderNodeMixRGB")
        links.new(geo.outputs["Backfacing"], mix.inputs["Fac"])
        links.new(front.outputs["Color"], mix.inputs["Color1"]); links.new(back.outputs["Color"], mix.inputs["Color2"])
        links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        links.new(front.outputs["Color"], bsdf.inputs["Base Color"])
    return m

# ---------------- world & floor ----------------
world = bpy.data.worlds.new("W"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.70, 0.76, 0.86, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32

bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
floor = bpy.context.object; floor.data.materials.append(mat_diffuse("floor", (0.78, 0.81, 0.88), 0.95))

# ---------------- book ----------------
cover_m = mat_diffuse("cover", (0.04, 0.24, 0.19), 0.55)
edge_m = mat_diffuse("edge", (0.93, 0.90, 0.82), 0.9)

def box(name, size, loc, mat):
    bpy.ops.mesh.primitive_cube_add(location=loc); o = bpy.context.object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new("bev", "BEVEL"); bv.width = 0.0015; bv.segments = 2
    o.data.materials.append(mat); return o

# covers (slightly larger than pages), open flat
box("cover_L", (PW + 0.008, PH + 0.012, 0.003), (-(PW + 0.008) / 2 - 0.002, 0, 0.0015), cover_m)
box("cover_R", (PW + 0.008, PH + 0.012, 0.003), ((PW + 0.008) / 2 + 0.002, 0, 0.0015), cover_m)
# page blocks
box("block_L", (PW, PH, STACK), (-PW / 2 - 0.001, 0, 0.003 + STACK / 2), edge_m)
box("block_R", (PW, PH, STACK), (PW / 2 + 0.001, 0, 0.003 + STACK / 2), edge_m)
TOP = 0.003 + STACK + 0.0004

def page_plane(name, x_sign, mat, z):
    """Subdivided page; origin on the gutter (x=0); spans x in [0, PW] * x_sign."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    o = bpy.context.object; o.name = name
    o.scale = (PW / 2, PH / 2, 1); bpy.ops.object.transform_apply(scale=True)
    o.location = (x_sign * PW / 2, 0, 0); bpy.ops.object.transform_apply(location=True)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.subdivide(number_cuts=30); bpy.ops.object.mode_set(mode="OBJECT")
    o.location = (0, 0, z)
    if x_sign < 0:   # left-side page: mirror UVs so the image reads correctly
        for uv in o.data.uv_layers.active.data:
            pass
    o.data.materials.append(mat)
    o.modifiers.new("solid", "SOLIDIFY").thickness = 0.0003
    return o

# static top pages
page_plane("top_L", -1, mat_image("pL", "page_left.jpg"), TOP)
page_plane("top_R", +1, mat_image("pR", "page_frames.jpg"), TOP)

# flipping pages (start on the left, flip to the right: Arabic reading order).
# The page shape is computed each frame: the sheet leaves the gutter at angle theta and the
# free edge lags behind (curvature), like real paper, then settles flat on the right.
flips = []
textures = [("page_right.jpg", "page_left.jpg"), ("page_left.jpg", "page_frames.jpg"), ("page_right.jpg", "page_frames.jpg")]
for i, (fr, bk) in enumerate(textures):
    o = page_plane(f"flip{i}", -1, mat_image(f"pf{i}", fr, bk), TOP + 0.0006 * (i + 1))
    o["base"] = [c for v in o.data.vertices for c in (v.co.x, v.co.y)]
    flips.append(o)
STARTS = [18, 62, 104]; DURF = 46

def ease(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

def profile(theta, lag, n=64):
    """Return list of (s, x, z) along the sheet for angle theta at the gutter and total lag."""
    pts = [(0.0, 0.0, 0.0)]; x = z = 0.0; ds = PW / n
    for j in range(1, n + 1):
        sm = (j - 0.5) * ds
        phi = max(0.0, min(math.pi, theta - lag * (sm / PW) ** 1.3))
        x += -math.cos(phi) * ds; z += math.sin(phi) * ds
        pts.append((j * ds, x, z))
    return pts

def update_pages(scene, *args):
    f = scene.frame_current
    for i, o in enumerate(flips):
        k = ease((f - STARTS[i]) / DURF)
        theta = math.pi * k
        lag = 1.1 * math.sin(math.pi * k) * (1.0 if k < 0.5 else 0.8)
        prof = profile(theta, lag)
        base = o["base"]; me = o.data
        for vi, v in enumerate(me.vertices):
            bx, by = base[2 * vi], base[2 * vi + 1]
            sv = min(PW, max(0.0, -bx)); t = sv / PW * (len(prof) - 1); j = min(int(t), len(prof) - 2); u = t - j
            x = prof[j][1] * (1 - u) + prof[j + 1][1] * u; z = prof[j][2] * (1 - u) + prof[j + 1][2] * u
            v.co = (x, by, z + 0.0006 * (i + 1) * (1 - k) + 0.0006 * (3 - i) * k)
        me.update()
        o.location.z = TOP

bpy.app.handlers.frame_change_pre.clear()
bpy.app.handlers.frame_change_pre.append(update_pages)

# tilt the whole book on the surface
bpy.ops.object.empty_add(location=(0, 0, 0)); book = bpy.context.object; book.name = "BOOK"
for o in list(bpy.data.objects):
    if o.name.startswith(("cover_", "block_", "top_", "flip")):
        o.parent = book
book.rotation_euler = (0, 0, math.radians(-18))

# ---------------- light with leaf gobo ----------------
sun_data = bpy.data.lights.new("sun", "SUN"); sun_data.energy = 1.6; sun_data.angle = math.radians(2.5)
sun = bpy.data.objects.new("sun", sun_data); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(38), math.radians(-14), math.radians(28))
# gobo plane between sun and scene (invisible to camera)
bpy.ops.mesh.primitive_plane_add(size=1.6, location=(0.25, -0.35, 0.9)); gobo = bpy.context.object
gobo.rotation_euler = sun.rotation_euler
gm = bpy.data.materials.new("gobo"); gm.use_nodes = True; gn = gm.node_tree
for n in list(gn.nodes):
    if n.type != "OUTPUT_MATERIAL": gn.nodes.remove(n)
gi = gn.nodes.new("ShaderNodeTexImage"); gi.image = img("leaves_gobo.png")
tr = gn.nodes.new("ShaderNodeBsdfTransparent"); df = gn.nodes.new("ShaderNodeBsdfDiffuse"); df.inputs["Color"].default_value = (0, 0, 0, 1)
mx = gn.nodes.new("ShaderNodeMixShader")
gn.links.new(gi.outputs["Alpha"], mx.inputs["Fac"]); gn.links.new(tr.outputs[0], mx.inputs[1]); gn.links.new(df.outputs[0], mx.inputs[2])
gn.links.new(mx.outputs[0], gn.nodes["Material Output"].inputs["Surface"])
gobo.data.materials.append(gm)
gobo.visible_camera = False; gobo.visible_glossy = False; gobo.visible_diffuse = False
# slow drift of the leaf shadows
gobo.keyframe_insert("location", frame=1); gobo.location.x += 0.06; gobo.location.y += 0.03; gobo.keyframe_insert("location", frame=N)

fill = bpy.data.lights.new("fill", "AREA"); fill.energy = 18; fill.size = 2.0
fo = bpy.data.objects.new("fill", fill); sc.collection.objects.link(fo); fo.location = (-0.8, 0.9, 1.4)
fo.rotation_euler = (math.radians(-40), math.radians(-30), 0)

# ---------------- camera ----------------
cam_data = bpy.data.cameras.new("cam"); cam_data.lens = 50
cam_data.dof.use_dof = True; cam_data.dof.aperture_fstop = 2.2
cam = bpy.data.objects.new("cam", cam_data); sc.collection.objects.link(cam); sc.camera = cam
bpy.ops.object.empty_add(location=(0, 0, 0.02)); target = bpy.context.object; target.name = "target"
tc = cam.constraints.new("TRACK_TO"); tc.target = target; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
cam_data.dof.focus_object = target

# keyframes: wide overview -> slow orbit -> macro on the right page
KEYS = [  # frame, cam xyz, target xyz, fstop
    (1,   (0.05, -0.95, 0.85), (0.0, 0.0, 0.02), 4.0),
    (90,  (0.25, -0.70, 0.62), (0.02, 0.0, 0.02), 3.2),
    (150, (0.30, -0.45, 0.34), (0.08, -0.03, 0.016), 2.8),
    (216, (0.21, -0.25, 0.15), (0.095, -0.031, 0.016), 2.4),
]
for f, cl, tl, fs in KEYS:
    cam.location = cl; cam.keyframe_insert("location", frame=f)
    target.location = tl; target.keyframe_insert("location", frame=f)
    cam_data.dof.aperture_fstop = fs; cam_data.dof.keyframe_insert("aperture_fstop", frame=f)
for o in (cam, target):
    if o.animation_data and o.animation_data.action:
        for fc in o.animation_data.action.fcurves:
            for kp in fc.keyframe_points: kp.interpolation = "BEZIER"; kp.easing = "EASE_IN_OUT"

# ---------------- render ----------------
os.makedirs(OUT, exist_ok=True)
sc.render.image_settings.file_format = "PNG"
if FRAMES:
    for f in [int(x) for x in FRAMES.split(",")]:
        sc.frame_set(f); sc.render.filepath = os.path.join(OUT, f"test_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
else:
    sc.render.filepath = os.path.join(OUT, "f")
    bpy.ops.render.render(animation=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "scene.blend"))
