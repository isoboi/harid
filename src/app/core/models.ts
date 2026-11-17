/** Модели публичного API витрины (/market/*). Формы совпадают с ответами бэкенда distributor. */
export interface Category { slug: string; name: string }
export interface Shop { handle: string; name: string; bio: string; followers: number; district: string | null; rating: number | null; delivered_orders: number; joined_at: string; avatar_color: string; has_fresh: boolean }
export interface Product { id: string; shop_handle: string; title: string; price: number; old_price: number | null; image: string; category: string | null; description: string; sizes: string[]; in_stock: boolean; posted_at: string; images?: string[] }
export type OrderStage = 'placed' | 'assembling' | 'in_delivery' | 'delivered' | 'cancelled';
export interface OrderCustomer { name: string; phone: string; district: string; address: string; comment?: string }
export interface OrderLineInput { product_id: number; size?: string; qty: number }
export interface CreateOrderInput { customer: OrderCustomer; slot: string; payment: 'cash'; lines: OrderLineInput[] }
export interface OrderLine { product_id: string; shop_handle: string; title: string; price: number; image: string; size: string | null; qty: number }
/** access_token приходит только в ответе POST /market/orders: им открывают заказ по ссылке без телефона. */
export interface Order { number: string; access_token?: string; created_at: string; customer: OrderCustomer; slot: string; payment: 'cash'; stage: OrderStage; items_total: number; delivery_total: number; lines: OrderLine[]; shops: { shop_handle: string; status: string }[] }
/** Покупатель как его отдаёт бэкенд (mapBuyer): name может быть пустым. */
export interface Buyer { id: number; phone: string; name: string | null }
export interface VerifyResult { token: string; buyer: Buyer; is_new: boolean }
export interface ProductQuery { category?: string; shop?: string; q?: string; limit?: number }
