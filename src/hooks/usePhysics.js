import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Matter from 'matter-js';

const { Engine, World, Bodies, Body, Composite, Events } = Matter;

const WORLD_WIDTH = 900;
const WORLD_HEIGHT = 1280;
const WALL_THICKNESS = 30;
const SLOT_HEIGHT = 110;
const PEG_RADIUS = 7;
const MARBLE_RADIUS = 11;

function createSlots(items) {
  const totalWeight = Math.max(1, items.reduce((sum, item) => sum + item.weight, 0));
  let cursorX = WALL_THICKNESS;

  return items.map((item, index) => {
    const ratio = item.weight / totalWeight;
    const width = (WORLD_WIDTH - WALL_THICKNESS * 2) * ratio;
    const slot = {
      ...item,
      index,
      x: cursorX,
      width,
      centerX: cursorX + width / 2
    };
    cursorX += width;
    return slot;
  });
}

function resolveCanvasSize(canvas, container) {
  if (!canvas || !container) return;
  const width = container.clientWidth;
  const height = width * (WORLD_HEIGHT / WORLD_WIDTH);
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

export function usePhysics({ items, onSettle }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const marblesRef = useRef([]);
  const slotsRef = useRef([]);
  const frameRef = useRef(0);
  const dropQueueRef = useRef([]);
  const roundIdRef = useRef(0);
  const nextDropAtRef = useRef(0);
  const lastResultRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeMarbles, setActiveMarbles] = useState(0);
  const [lastResult, setLastResult] = useState(null);

  const slots = useMemo(() => createSlots(items), [items]);

  const clearWorld = useCallback(() => {
    if (!engineRef.current) return;
    World.clear(engineRef.current.world, false);
    Engine.clear(engineRef.current);
    marblesRef.current = [];
    slotsRef.current = [];
  }, []);

  useEffect(() => {
    const engine = Engine.create({
      gravity: { x: 0, y: 0.92 }
    });
    engineRef.current = engine;

    const handleCollision = (event) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        const marbleBody = bodyA.label === 'marble' ? bodyA : bodyB.label === 'marble' ? bodyB : null;
        const slotBody = bodyA.label.startsWith('slot-sensor-') ? bodyA : bodyB.label.startsWith('slot-sensor-') ? bodyB : null;

        if (!marbleBody || !slotBody || marbleBody.isSleeping) continue;
        marbleBody.isSleeping = true;

        const meta = marbleBody.plugin.meta;
        const slotIndex = Number(slotBody.plugin.slotIndex);
        const slot = slotsRef.current[slotIndex];
        if (!meta || !slot) continue;

        const result = { label: slot.label, index: slot.index, color: slot.color };
        lastResultRef.current = result;
        setLastResult(result);
        onSettle?.({
          id: `${meta.roundId}-${meta.index}`,
          label: slot.label,
          color: slot.color,
          slotIndex: slot.index,
          sourceLabel: meta.sourceLabel
        });

        World.remove(engine.world, marbleBody);
        marblesRef.current = marblesRef.current.filter((entry) => entry.body.id !== marbleBody.id);
        setActiveMarbles(marblesRef.current.length + dropQueueRef.current.length);
      }
    };

    Events.on(engine, 'collisionStart', handleCollision);

    return () => {
      Events.off(engine, 'collisionStart', handleCollision);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      clearWorld();
    };
  }, [clearWorld, onSettle]);

  useEffect(() => {
    if (!engineRef.current) return;
    clearWorld();

    const engine = engineRef.current;
    const walls = [
      Bodies.rectangle(WALL_THICKNESS / 2, WORLD_HEIGHT / 2, WALL_THICKNESS, WORLD_HEIGHT, { isStatic: true, render: { visible: false } }),
      Bodies.rectangle(WORLD_WIDTH - WALL_THICKNESS / 2, WORLD_HEIGHT / 2, WALL_THICKNESS, WORLD_HEIGHT, { isStatic: true, render: { visible: false } }),
      Bodies.rectangle(WORLD_WIDTH / 2, WALL_THICKNESS / 2, WORLD_WIDTH, WALL_THICKNESS, { isStatic: true, render: { visible: false } }),
      Bodies.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - WALL_THICKNESS / 2, WORLD_WIDTH, WALL_THICKNESS, { isStatic: true, render: { visible: false } })
    ];

    const pins = [];
    const startY = 180;
    const rowGap = 68;
    const colGap = 74;
    const rows = 10;

    for (let row = 0; row < rows; row += 1) {
      const count = 7 + row;
      const rowWidth = (count - 1) * colGap;
      const offsetX = (WORLD_WIDTH - rowWidth) / 2;
      const y = startY + row * rowGap;

      for (let col = 0; col < count; col += 1) {
        const pin = Bodies.circle(offsetX + col * colGap, y, PEG_RADIUS, {
          isStatic: true,
          restitution: 0.8,
          friction: 0.001,
          label: 'pin'
        });
        pins.push(pin);
      }
    }

    const slotDividers = [];
    const slotSensors = [];
    slotsRef.current = slots;

    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      slotSensors.push(
        Bodies.rectangle(slot.centerX, WORLD_HEIGHT - SLOT_HEIGHT / 2, slot.width, SLOT_HEIGHT, {
          isStatic: true,
          isSensor: true,
          label: `slot-sensor-${i}`,
          plugin: { slotIndex: i }
        })
      );

      if (i < slots.length - 1) {
        slotDividers.push(
          Bodies.rectangle(slot.x + slot.width, WORLD_HEIGHT - SLOT_HEIGHT / 2, 10, SLOT_HEIGHT + 20, {
            isStatic: true,
            restitution: 0.5,
            friction: 0.001,
            label: 'divider'
          })
        );
      }
    }

    World.add(engine.world, [...walls, ...pins, ...slotDividers, ...slotSensors]);
    lastResultRef.current = null;
    setLastResult(null);
    setActiveMarbles(0);
  }, [slots, clearWorld]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !engineRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

      const draw = (timestamp = 0) => {
        const engine = engineRef.current;
        if (!engine) return;

        resolveCanvasSize(canvas, container);
        const scaleX = canvas.width / WORLD_WIDTH;
      const scaleY = canvas.height / WORLD_HEIGHT;

      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      const bg = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
      bg.addColorStop(0, '#020617');
      bg.addColorStop(0.55, '#111827');
      bg.addColorStop(1, '#0f172a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(WALL_THICKNESS, WALL_THICKNESS, WORLD_WIDTH - WALL_THICKNESS * 2, WORLD_HEIGHT - WALL_THICKNESS * 2);

      for (const slot of slotsRef.current) {
        const isWinner = lastResultRef.current?.index === slot.index;
        ctx.fillStyle = isWinner ? 'rgba(244, 114, 182, 0.28)' : 'rgba(15, 23, 42, 0.96)';
        ctx.fillRect(slot.x, WORLD_HEIGHT - SLOT_HEIGHT, slot.width, SLOT_HEIGHT);
        ctx.strokeStyle = isWinner ? 'rgba(244, 114, 182, 0.8)' : 'rgba(56, 189, 248, 0.32)';
        ctx.strokeRect(slot.x, WORLD_HEIGHT - SLOT_HEIGHT, slot.width, SLOT_HEIGHT);

        ctx.fillStyle = slot.color;
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${slot.label} x${slot.weight}`, slot.centerX, WORLD_HEIGHT - 38);
      }

      const bodies = Composite.allBodies(engine.world);
      for (const body of bodies) {
        if (body.label === 'pin') {
          ctx.beginPath();
          ctx.arc(body.position.x, body.position.y, PEG_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = '#67e8f9';
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        if (body.label === 'marble') {
          const color = body.plugin.meta?.color ?? '#f8fafc';
          ctx.beginPath();
          ctx.arc(body.position.x, body.position.y, MARBLE_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 18;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      Engine.update(engine, 1000 / 60);

      if (dropQueueRef.current.length > 0 && timestamp >= nextDropAtRef.current) {
        const next = dropQueueRef.current.shift();
        const marble = Bodies.circle(WORLD_WIDTH / 2 + (Math.random() - 0.5) * 40, 70 + Math.random() * 12, MARBLE_RADIUS, {
          restitution: 0.72,
          friction: 0.0005,
          frictionAir: 0.0025,
          density: 0.0014,
          label: 'marble',
          plugin: {
            meta: next
          }
        });
        World.add(engine.world, marble);
        marblesRef.current.push({ body: marble, meta: next });
        nextDropAtRef.current = timestamp + 140;
      }

      if (marblesRef.current.length === 0 && dropQueueRef.current.length === 0) {
        setIsRunning(false);
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    const resizeObserver = new ResizeObserver(() => resolveCanvasSize(canvas, container));
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [slots.length]);

  const startRound = useCallback((count = 1) => {
    if (!engineRef.current || slots.length === 0) return;
    roundIdRef.current += 1;
    const marbles = Array.from({ length: Math.max(1, count) }, (_, index) => ({
      roundId: roundIdRef.current,
      index,
      sourceLabel: `marble-${index + 1}`,
      color: '#f8fafc'
    }));
    dropQueueRef.current = marbles;
    nextDropAtRef.current = 0;
    setActiveMarbles(marbles.length);
    setIsRunning(true);
    lastResultRef.current = null;
    setLastResult(null);
  }, [slots.length]);

  const startWeightedRound = useCallback((count = 1) => {
    if (!engineRef.current || slots.length === 0) return;
    roundIdRef.current += 1;
    const marbles = Array.from({ length: Math.max(1, count) }, (_, index) => ({
      roundId: roundIdRef.current,
      index,
      sourceLabel: `weighted-${index + 1}`,
      color: slots[index % slots.length]?.color ?? '#f8fafc'
    }));

    dropQueueRef.current = marbles;
    nextDropAtRef.current = 0;
    setActiveMarbles(marbles.length);
    setIsRunning(true);
    lastResultRef.current = null;
    setLastResult(null);
  }, [slots]);

  const resetRound = useCallback(() => {
    if (!engineRef.current) return;
    const engine = engineRef.current;
    Composite.allBodies(engine.world)
      .filter((body) => body.label === 'marble')
      .forEach((body) => World.remove(engine.world, body));
    marblesRef.current = [];
    dropQueueRef.current = [];
    nextDropAtRef.current = 0;
    setActiveMarbles(0);
    setIsRunning(false);
    lastResultRef.current = null;
    setLastResult(null);
  }, []);

  return {
    canvasRef,
    containerRef,
    slots,
    isRunning,
    activeMarbles,
    lastResult,
    startRound,
    startWeightedRound,
    resetRound
  };
}
