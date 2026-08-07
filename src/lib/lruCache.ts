/**
 * Cache LRU (Least Recently Used) nhỏ gọn dùng chung cho các nơi cache dữ liệu
 * nặng trong bộ nhớ (vd ảnh PDF render ra data URL) — tránh phình RAM vô hạn
 * khi người dùng dùng app lâu / lướt qua nhiều trang tài liệu.
 *
 * Dựa trên thứ tự chèn của Map: mỗi lần get/set 1 key, key đó được đưa lên
 * "mới nhất". Khi vượt `capacity`, entry cũ nhất (ít dùng gần đây nhất) bị xóa.
 */
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly capacity: number) {
    if (capacity <= 0) throw new Error("LruCache capacity phải > 0");
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value); // đưa lên mới nhất
    return value;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    this.map.delete(key); // xóa trước để set lại đưa key lên mới nhất
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
}
