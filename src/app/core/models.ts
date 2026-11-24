/** Модели публичного API витрины (/market/*). Формы совпадают с ответами бэкенда distributor. */
export interface Category { slug: string; name: string }
export interface Shop { handle: string; name: string; bio: string; followers: number; district: string | null; rating: number | null; delivered_orders: number; joined_at: string; avatar_color: string; has_fresh: boolean; avatar_url?: string | null; reviews_count?: number; verified?: boolean; direct_url?: string | null }
/**
 * price null — цену лавка называет в Direct (неподключённая лавка, shop_verified=false).
 * shop_verified=false: лавка заведена импортом из Instagram, заказы только через direct_url.
 */
export interface Product { id: string; shop_handle: string; title: string; price: number | null; old_price: number | null; image: string; category: string | null; description: string; sizes: string[]; in_stock: boolean; posted_at: string; images?: string[]; rating?: number | null; reviews_count?: number; video?: string | null; permalink?: string | null; shop_verified?: boolean; direct_url?: string | null }
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
/** Сортировка ленты: new — новые сверху; по цене сервер скрывает товары «цена в Direct». */
export type ProductSort = 'new' | 'price_asc' | 'price_desc';
/** Фильтры ленты поверх категории/поиска; живут в query-параметрах адреса. */
export interface FeedFilters { sort?: ProductSort; price_min?: number; price_max?: number; size?: string; in_stock?: boolean }
export interface ProductQuery extends FeedFilters { category?: string; shop?: string; q?: string; limit?: number; offset?: number }
/** GET /market/products/facets: варианты (частые первыми) и диапазон цен; null — товаров с ценой нет. */
/** Подсказки поиска при наборе (GET /market/search/suggest). */
export interface SearchSuggestions { products: Pick<Product, 'id' | 'title' | 'price' | 'image' | 'shop_handle'>[]; shops: { handle: string; name: string; avatar_color: string; avatar_url: string | null }[]; categories: Category[] }
export interface ProductFacets { sizes: string[]; price_min: number | null; price_max: number | null }
/** Отзыв о товаре: GET /market/reviews?product=<id> | ?shop=<handle>, новые первыми. */
/** Публичный ответ лавки на отзыв (решение 0007). */
export interface ReviewReply { text: string; created_at: string }
export interface Review { id: number | string; product_id: string; product_title: string; shop_handle: string; author: string; rating: number; text: string; created_at: string; reply?: ReviewReply | null }
/** Сводка отзывов с сервера: средняя (null без отзывов), число и распределение по звёздам. */
export interface ReviewSummary { rating: number | null; count: number; distribution: Record<'5' | '4' | '3' | '2' | '1', number> }
/** Купленный и полученный товар, который можно оценить: GET /market/me/reviewable. */
export interface Reviewable { product_id: string; product_title: string; image: string; shop_handle: string; order_number: string; review: null | { rating: number; text: string } }
/** Тело POST /market/reviews: product_id — число, как в строках заказа. */
export interface ReviewInput { product_id: number; rating: number; text?: string }
/** rating — только эта оценка; with_text — только с текстом. Фильтры применяет сервер. */
export interface ReviewQuery { product?: string; shop?: string; rating?: number; with_text?: boolean }
/** Возврат товаров из доставленного заказа: запрошен → одобрен → деньги возвращены; либо отказ лавки или отмена покупателем. */
export type ReturnStatus = 'requested' | 'approved' | 'refunded' | 'rejected' | 'cancelled';
export interface ReturnItem { line_id: number; product_id: string; title: string; image: string; size: string | null; price: number; qty: number }
export interface MarketReturn { id: number; number: string | null; order_id: number; shop_handle: string; shop_name: string; status: ReturnStatus; reason: string; shop_comment: string; amount: number; created_at: string; decided_at: string | null; refunded_at: string | null; items: ReturnItem[] }
/** Доставленная заявка лавки, из которой ещё можно вернуть товар; available — сколько штук строки осталось. */
export interface ReturnableOrder { order_id: number; number: string | null; shop_handle: string; shop_name: string; shop_phone: string; delivered_at: string; deadline: string; lines: (ReturnItem & { available: number })[] }
export interface ReturnInput { order_id: number; reason: string; items: { line_id: number; qty: number }[] }
/** Чат покупателя с лавкой (/market/chats). Телефон покупателя в ответах чата не приходит. */
export type ChatSender = 'buyer' | 'shop';
export interface ChatProduct { id: string; title: string; image: string; price: number }
export interface ChatMessage { id: number; chat_id: number; sender: ChatSender; text: string; product: ChatProduct | null; created_at: string }
export interface ChatSummary { id: number; shop: { handle: string; name: string; avatar_color: string }; last_message: { text: string; sender: ChatSender; created_at: string; product_title: string | null } | null; unread: number }
export interface StartChatInput { shop_handle: string; text: string; product_id?: number }
export interface SendMessageInput { text: string; product_id?: number }
