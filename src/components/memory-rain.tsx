"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, Loader2, X } from "lucide-react";
import * as THREE from "three";

type Fragment = {
  id: string;
  noteId?: string;
  text: string;
  tone?: string | null;
  weight?: number;
  createdAt?: string;
};

type MemoryRainResponse = {
  seed?: number;
  fragments?: Fragment[];
};

type MemoryNote = {
  id: string;
  content: string;
  source: string;
  aiStatus: string;
  createdAt: string;
  clientCreatedAt?: string | null;
  analysis?: {
    poeticFragment?: string | null;
    summary?: string | null;
    mood?: string | null;
    keywords?: string[];
  } | null;
};

type NoteState =
  | { status: "idle"; note: null; error: "" }
  | { status: "loading"; note: null; error: "" }
  | { status: "ready"; note: MemoryNote; error: "" }
  | { status: "error"; note: null; error: string };

const fallbackFragments: Fragment[] = [
  { id: "seed-1", text: "把短暂的念头，交给长久的回声。" },
  { id: "seed-2", text: "未来会感谢今天没有遗失的这一句。" },
  { id: "seed-3", text: "记录不是整理，是给灵感留门。" },
];

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function sourceLabel(source: string) {
  return source.replaceAll("_", " ").toLowerCase();
}

function formatNoteTime(note?: MemoryNote | null) {
  if (!note) return "";
  const value = note.clientCreatedAt ?? note.createdAt;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function makeTextTexture(text: string, tone?: string | null) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 1024;
  canvas.height = 180;

  if (context) {
    const shortText = text.replace(/\s+/g, " ").slice(0, 46);
    const accent = tone ? "rgba(143, 169, 161, 0.48)" : "rgba(204, 156, 94, 0.42)";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "500 40px serif";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(248, 244, 234, 0.84)";
    context.shadowColor = accent;
    context.shadowBlur = 22;
    context.fillText(shortText, 28, 88, 940);
    context.shadowBlur = 0;
    context.fillStyle = "rgba(248, 244, 234, 0.18)";
    context.fillRect(28, 136, Math.min(context.measureText(shortText).width, 900), 1.2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

export function MemoryRain() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  const [hoveredText, setHoveredText] = useState("");
  const [noteState, setNoteState] = useState<NoteState>({ status: "idle", note: null, error: "" });

  const closeReveal = useCallback(() => {
    setActiveFragment(null);
    setNoteState({ status: "idle", note: null, error: "" });
  }, []);

  const openFragment = useCallback(async (fragment: Fragment) => {
    setActiveFragment(fragment);

    if (!fragment.noteId) {
      setNoteState({ status: "error", note: null, error: "这条回响暂时没有关联原文。" });
      return;
    }

    setNoteState({ status: "loading", note: null, error: "" });
    const response = await fetch(`/api/notes/${encodeURIComponent(fragment.noteId)}`).catch(() => null);

    if (response?.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response?.ok) {
      setNoteState({ status: "error", note: null, error: "没有取回这条小记，请稍后再试。" });
      return;
    }

    const body = (await response.json()) as { note?: MemoryNote };
    if (!body.note) {
      setNoteState({ status: "error", note: null, error: "没有找到这条小记。" });
      return;
    }

    setNoteState({ status: "ready", note: body.note, error: "" });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let frameId = 0;
    let hoverFrame = 0;
    let hoveredSprite: THREE.Sprite | null = null;
    const sprites: THREE.Sprite[] = [];
    const pointer = new THREE.Vector2(9, 9);
    const raycaster = new THREE.Raycaster();
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x101113, 0.0007);

    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 1, 2200);
    camera.position.set(0, 30, 820);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearAlpha(0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 640 ? 1.25 : 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.cursor = "default";
    renderer.domElement.style.touchAction = "manipulation";
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.x = -0.08;
    scene.add(group);

    const ambient = new THREE.AmbientLight(0xf8f4ea, 0.46);
    const sideLight = new THREE.DirectionalLight(0xc28a48, 1.8);
    sideLight.position.set(240, 260, 520);
    scene.add(ambient, sideLight);

    const fieldGeometry = new THREE.BufferGeometry();
    const pointCount = window.innerWidth < 640 ? 280 : 520;
    const positions = new Float32Array(pointCount * 3);
    for (let index = 0; index < positions.length; index += 3) {
      positions[index] = Math.random() * 1800 - 900;
      positions[index + 1] = Math.random() * 1100 - 550;
      positions[index + 2] = Math.random() * 1200 - 900;
    }
    fieldGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const fieldMaterial = new THREE.PointsMaterial({ color: 0x8fa9a1, size: 1.4, transparent: true, opacity: 0.28, depthWrite: false });
    const field = new THREE.Points(fieldGeometry, fieldMaterial);
    scene.add(field);

    async function loadFragments() {
      const response = await fetch("/api/memory-rain").catch(() => null);
      if (!response?.ok) return { seed: 1, fragments: fallbackFragments };
      const body = (await response.json()) as MemoryRainResponse;
      return {
        seed: body.seed ?? 1,
        fragments: body.fragments?.length ? body.fragments : fallbackFragments,
      };
    }

    loadFragments().then(({ seed, fragments }) => {
      if (disposed) return;
      const rng = createRng(seed);
      const maxSprites = window.innerWidth < 640 ? 20 : 42;
      const amount = Math.min(Math.max(fragments.length, 12), maxSprites);

      for (let index = 0; index < amount; index += 1) {
        const fragment = fragments[index % fragments.length];
        const z = rng() * 1050 - 780;
        const material = new THREE.SpriteMaterial({
          map: makeTextTexture(fragment.text, fragment.tone),
          transparent: true,
          opacity: 0.18 + rng() * 0.32,
          depthTest: false,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        const scaleX = 300 + rng() * 300 + Math.max(0, z + 780) * 0.05;
        const scaleY = 54 + rng() * 28;
        sprite.position.set(rng() * 1500 - 750, rng() * 980 - 490, z);
        sprite.scale.set(scaleX, scaleY, 1);
        sprite.userData = {
          fragment,
          speed: 0.14 + rng() * 0.35,
          drift: 0.03 + rng() * 0.11,
          phase: rng() * Math.PI * 2,
          baseOpacity: material.opacity,
          baseScaleX: scaleX,
          baseScaleY: scaleY,
        };
        sprites.push(sprite);
        group.add(sprite);
      }
    });

    function setPointerFromEvent(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function handlePointerMove(event: PointerEvent) {
      setPointerFromEvent(event);
    }

    function handlePointerLeave() {
      pointer.set(9, 9);
      setHoveredText("");
    }

    function handlePointerDown(event: PointerEvent) {
      setPointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(sprites, false)[0];
      if (hit?.object) {
        const fragment = (hit.object as THREE.Sprite).userData.fragment as Fragment;
        void openFragment(fragment);
      }
    }

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 640 ? 1.25 : 1.75));
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate(time: number) {
      if (disposed) return;

      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(sprites, false)[0];
      const nextHover = (hit?.object as THREE.Sprite | undefined) ?? null;
      if (nextHover !== hoveredSprite) {
        hoveredSprite = nextHover;
        renderer.domElement.style.cursor = hoveredSprite ? "pointer" : "default";
        if (time - hoverFrame > 80) {
          hoverFrame = time;
          setHoveredText(hoveredSprite ? ((hoveredSprite.userData.fragment as Fragment).text) : "");
        }
      }

      sprites.forEach((sprite, index) => {
        const material = sprite.material as THREE.SpriteMaterial;
        const baseOpacity = sprite.userData.baseOpacity as number;
        const baseScaleX = sprite.userData.baseScaleX as number;
        const baseScaleY = sprite.userData.baseScaleY as number;
        const isHovered = sprite === hoveredSprite;
        const targetOpacity = isHovered ? Math.min(baseOpacity + 0.34, 0.78) : baseOpacity;
        const targetScale = isHovered ? 1.12 : 1;

        material.opacity += (targetOpacity - material.opacity) * 0.08;
        material.color.set(isHovered ? 0xfff4d8 : 0xffffff);
        sprite.scale.x += (baseScaleX * targetScale - sprite.scale.x) * 0.08;
        sprite.scale.y += (baseScaleY * targetScale - sprite.scale.y) * 0.08;
        sprite.position.y -= (sprite.userData.speed as number) * (isHovered ? 0.18 : 1);
        sprite.position.x += Math.sin(time * 0.00023 + (sprite.userData.phase as number) + index) * (sprite.userData.drift as number);

        if (sprite.position.y < -560) {
          sprite.position.y = 560;
          sprite.position.x = ((sprite.position.x + 830) % 1660) - 830;
        }
      });

      field.rotation.y = Math.sin(time * 0.00005) * 0.08;
      group.rotation.y = Math.sin(time * 0.00007) * 0.12;
      group.position.x = Math.sin(time * 0.00009) * 18;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", onResize);
    frameId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", onResize);
      renderer.domElement.style.cursor = "default";
      sprites.forEach((sprite) => {
        const material = sprite.material as THREE.SpriteMaterial;
        material.map?.dispose();
        material.dispose();
      });
      fieldGeometry.dispose();
      fieldMaterial.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, [openFragment]);

  return (
    <>
      <div ref={hostRef} className="fixed inset-0 z-0 opacity-90 max-sm:opacity-60" aria-hidden />
      <p className="sr-only" aria-live="polite">
        {hoveredText ? `当前回响：${hoveredText}` : ""}
      </p>
      {activeFragment ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center px-3 pb-3 sm:items-center sm:px-6 sm:pb-0">
          <button type="button" aria-label="关闭小记" className="absolute inset-0 cursor-default bg-black/30 backdrop-blur-[2px]" onClick={closeReveal} />
          <section className="pointer-events-auto relative w-full max-w-2xl rounded-lg border border-paper/12 bg-ink-soft/88 p-5 shadow-[0_32px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-serif text-sm text-amber">Memory</p>
                <p className="mt-1 line-clamp-2 font-serif text-lg leading-8 text-paper-muted">{activeFragment.text}</p>
              </div>
              <button
                type="button"
                aria-label="关闭小记"
                onClick={closeReveal}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-paper/7 text-paper-muted transition hover:border-paper/30 hover:text-paper focus:outline-none focus:ring-4 focus:ring-amber/20"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {noteState.status === "loading" ? (
              <div className="flex min-h-40 items-center justify-center text-paper-muted" role="status">
                <Loader2 className="mr-2 animate-spin" size={18} aria-hidden />
                正在取回原文
              </div>
            ) : null}

            {noteState.status === "error" ? <p className="rounded-lg border border-rose/35 bg-rose/10 p-4 text-sm leading-7 text-paper">{noteState.error}</p> : null}

            {noteState.status === "ready" ? (
              <div>
                <p className="whitespace-pre-wrap text-base leading-8 text-paper sm:text-lg sm:leading-9">{noteState.note.content}</p>
                {noteState.note.analysis?.summary ? <p className="mt-4 border-l border-amber/50 pl-4 text-sm leading-7 text-paper-muted">{noteState.note.analysis.summary}</p> : null}
                <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-paper-muted">
                  <span className="inline-flex items-center gap-2">
                    <Clock3 size={14} aria-hidden />
                    <time dateTime={noteState.note.createdAt}>{formatNoteTime(noteState.note)}</time>
                  </span>
                  <span>{sourceLabel(noteState.note.source)}</span>
                  {noteState.note.analysis?.mood ? <span>{noteState.note.analysis.mood}</span> : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
