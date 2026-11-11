import { circleCircle, clamp } from './MathUtils.js';

/**
 * Reusable quadtree used for broad-phase collision queries.
 * The tree structure is kept between frames (clear() empties it) so that
 * rebuilding the spatial index every tick does not allocate new nodes.
 */
export class Quadtree {
  static queryCount = 0;
  static MAX_RADIUS = 160;

  constructor(x, y, w, h, capacity = 8, depth = 0, maxDepth = 6) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.capacity = capacity;
    this.depth = depth;
    this.maxDepth = maxDepth;
    this.objects = [];
    this.children = null;
    this._right = x + w;
    this._bottom = y + h;
  }

  static resetStats() {
    Quadtree.queryCount = 0;
  }

  clear() {
    this.objects.length = 0;
    if (this.children) {
      for (let i = 0; i < 4; i++) this.children[i].clear();
    }
  }

  contains(px, py) {
    return px >= this.x && px < this._right && py >= this.y && py < this._bottom;
  }

  subdivide() {
    const hw = this.w * 0.5;
    const hh = this.h * 0.5;
    const d = this.depth + 1;
    this.children = [
      new Quadtree(this.x, this.y, hw, hh, this.capacity, d, this.maxDepth),
      new Quadtree(this.x + hw, this.y, hw, hh, this.capacity, d, this.maxDepth),
      new Quadtree(this.x, this.y + hh, hw, hh, this.capacity, d, this.maxDepth),
      new Quadtree(this.x + hw, this.y + hh, hw, hh, this.capacity, d, this.maxDepth)
    ];
  }

  insert(obj) {
    if (!this.contains(obj.x, obj.y)) return false;

    if (this.children) {
      for (let i = 0; i < 4; i++) {
        if (this.children[i].contains(obj.x, obj.y)) {
          return this.children[i].insert(obj);
        }
      }
    }

    this.objects.push(obj);

    if (!this.children && this.objects.length > this.capacity && this.depth < this.maxDepth) {
      this.subdivide();
      const held = this.objects;
      this.objects = [];
      for (let i = 0; i < held.length; i++) {
        const o = held[i];
        let placed = false;
        for (let c = 0; c < 4; c++) {
          if (this.children[c].contains(o.x, o.y)) {
            this.children[c].objects.push(o);
            placed = true;
            break;
          }
        }
        if (!placed) this.objects.push(o);
      }
      for (let c = 0; c < 4; c++) {
        const child = this.children[c];
        if (child.objects.length > child.capacity && child.depth < child.maxDepth) {
          child._splitHeld();
        }
      }
    }
    return true;
  }

  _splitHeld() {
    if (this.children || this.depth >= this.maxDepth) return;
    if (this.objects.length <= this.capacity) return;
    this.subdivide();
    const held = this.objects;
    this.objects = [];
    for (let i = 0; i < held.length; i++) {
      const o = held[i];
      let placed = false;
      for (let c = 0; c < 4; c++) {
        if (this.children[c].contains(o.x, o.y)) {
          this.children[c].objects.push(o);
          placed = true;
          break;
        }
      }
      if (!placed) this.objects.push(o);
    }
    for (let c = 0; c < 4; c++) {
      this.children[c]._splitHeld();
    }
  }

  _intersectsCircle(cx, cy, cr) {
    const nx = clamp(cx, this.x, this._right);
    const ny = clamp(cy, this.y, this._bottom);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy <= cr * cr;
  }

  /**
   * Broad phase query. Returns candidates whose circles overlap the query
   * circle. `out` should be a reusable array owned by the caller.
   */
  query(cx, cy, cr, out) {
    Quadtree.queryCount++;
    if (!this._intersectsCircle(cx, cy, cr + Quadtree.MAX_RADIUS)) return out;

    const list = this.objects;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (circleCircle(cx, cy, cr, o.x, o.y, o.r || 0)) out.push(o);
    }
    if (this.children) {
      for (let i = 0; i < 4; i++) {
        this.children[i].query(cx, cy, cr, out);
      }
    }
    return out;
  }

  countNodes() {
    let n = 1;
    if (this.children) {
      for (let i = 0; i < 4; i++) n += this.children[i].countNodes();
    }
    return n;
  }

  countObjects() {
    let n = this.objects.length;
    if (this.children) {
      for (let i = 0; i < 4; i++) n += this.children[i].countObjects();
    }
    return n;
  }

  draw(ctx, labels = true) {
    const empty = this.objects.length === 0 && !this.children;
    if (empty && this.depth > 0) return;

    if (this.children) {
      ctx.strokeStyle = 'rgba(70, 244, 255, 0.16)';
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = this.objects.length > 0
        ? 'rgba(255, 200, 87, 0.5)'
        : 'rgba(139, 92, 255, 0.16)';
      ctx.lineWidth = 1;
    }
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.w - 1, this.h - 1);

    if (this.children) {
      for (let i = 0; i < 4; i++) this.children[i].draw(ctx, labels);
    }

    if (labels && this.objects.length > 0) {
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(255, 200, 87, 0.85)';
      ctx.fillText(`${this.objects.length}/${this.capacity}`, this.x + 4, this.y + 11);
      if (this.objects.length) {
        ctx.fillStyle = 'rgba(70, 244, 255, 0.9)';
        for (let i = 0; i < this.objects.length; i++) {
          const o = this.objects[i];
          ctx.fillRect(o.x - 1.5, o.y - 1.5, 3, 3);
        }
      }
    }
  }
}
