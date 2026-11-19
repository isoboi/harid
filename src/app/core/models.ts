/** Модели публичного API витрины (/market/*). Формы совпадают с ответами бэкенда distributor. */
export interface Category { slug: string; name: string }
export interface Shop { handle: string; name: string; bio: string; followers: number; district: string | null; rating: number | null; delivered_orders: number; joined_at: string; avatar_color: string; has_fresh: boolean; avatar_url?: string | null; reviews_count?: number }
export interface Product { id: string; shop_handle: string; title: string; price: number; old_price: number | null; image: string; category: string | null; description: string; sizes: string[]; in_stock: boolean; posted_at: string; images?: string[]; rating?: number | null; reviews_count?: number; video?: string | null; permalink?: string | null }
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
/** Отзыв о товаре: GET /market/reviews?product=<id> | ?shop=<handle>, новые первыми. */
export interface Review { id: number | string; product_id: string; product_title: string; shop_handle: string; author: string; rating: number; text: string; created_at: string }
/** Купленный и полученный товар, который можно оценить: GET /market/me/reviewable. */
export interface Reviewable { product_id: string; product_title: string; image: string; shop_handle: string; order_number: string; review: null | { rating: number; text: string } }
/** Тело POST /market/reviews: product_id — число, как в строках заказа. */
export interface ReviewInput { product_id: number; rating: number; text?: string }
export interface ReviewQuery { product?: string; shop?: string }
/** Возврат товаров из доставленного заказа: запрошен → одобрен → деньги возвращены; либо отказ лавки или отмена покупателем. */
export type ReturnStatus = 'requested' | 'approved' | 'refunded' | 'rejected' | 'cancelled';
export interface ReturnItem { line_id: number; product_id: string; title: string; image: string; size: string | null; price: number; qty: number }
export interface MarketReturn { id: number; number: string | null; order_id: number; shop_handle: string; shop_name: string; status: ReturnStatus; reason: string; shop_comment: string; amount: number; created_at: string; decided_at: string | null; refunded_at: string | null; items: ReturnItem[] }
/** Доставленная заявка лавки, из которой ещё можно вернуть товар; available — сколько штук строки осталось. */
export interface ReturnableOrder { order_id: number; number: string | null; shop_handle: string; shop_name: string; shop_phone: string; delivered_at: string; deadline: string; lines: (ReturnItem & { available: number })[] }
export interface ReturnInput { order_id: number; reason: string; items: { line_id: number; qty: number }[] }
