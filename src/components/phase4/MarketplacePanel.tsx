import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, PackageCheck, Plus, ShoppingBag, Truck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { MarketplaceOrderItem, MarketplaceProductItem } from '../../types/platform';
import { ResilientImage } from '../ResilientImage';

interface MarketplacePanelProps {
  churchId: number;
  canManage: boolean;
}

const PAYMENT_OPTIONS = [
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'mtn_momo', label: 'MTN Mobile Money' },
  { id: 'moov_money', label: 'Moov Money' },
  { id: 'wave', label: 'Wave CI' },
  { id: 'card', label: 'Carte Bancaire' },
];

export const MarketplacePanel: React.FC<MarketplacePanelProps> = ({ churchId, canManage }) => {
  const [products, setProducts] = useState<MarketplaceProductItem[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'solidarity'>('all');

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Littérature chrétienne');
  const [price, setPrice] = useState('10000');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [isSolidarityProduct, setIsSolidarityProduct] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProductItem | null>(null);
  const [qty, setQty] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [shippingAddress, setShippingAddress] = useState('Retrait à l’accueil de l’église');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, ordRes] = await Promise.all([
        apiFetch<{ products: MarketplaceProductItem[] }>(
          `/api/churches/${churchId}/marketplace/products`
        ),
        apiFetch<{ orders: MarketplaceOrderItem[] }>(
          `/api/churches/${churchId}/marketplace/orders`
        ),
      ]);
      setProducts(prodRes.products);
      setOrders(ordRes.orders);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/churches/${churchId}/marketplace/products`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          category,
          price: Number(price),
          stockQuantity: Number(stockQuantity),
          isSolidarityProduct,
        }),
      });
      setTitle('');
      setDescription('');
      setShowNew(false);
      setMessage('Article publié dans la boutique.');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur création article.');
    }
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ order: MarketplaceOrderItem }>(
        `/api/churches/${churchId}/marketplace/orders`,
        {
          method: 'POST',
          body: JSON.stringify({
            productId: selectedProduct.id,
            quantity: Number(qty),
            paymentMethod,
            shippingAddress,
          }),
        }
      );
      setSelectedProduct(null);
      setMessage(
        res.order.status === 'paid'
          ? `Commande ${res.order.paymentReference} payée et enregistrée.`
          : `Commande ${res.order.paymentReference} créée (statut : en attente de confirmation webhook).`
      );
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la commande.');
    }
  };

  const updateOrderStatus = async (orderId: number, status: 'shipped' | 'delivered') => {
    try {
      await apiFetch(`/api/churches/${churchId}/marketplace/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur mise à jour statut.');
    }
  };

  const visibleProducts =
    filter === 'solidarity' ? products.filter((p) => p.isSolidarityProduct) : products;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-white">
            Marketplace & Boutique Solidaire
          </h2>
          <p className="text-sm text-stone-500 dark:text-slate-400">
            Fonds commerciaux et produits solidaires comptabilisés dans des registres distincts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-600 dark:border-amber-600'
                : 'border-stone-200 dark:border-slate-700'
            }`}
          >
            Tout le catalogue
          </button>
          <button
            type="button"
            onClick={() => setFilter('solidarity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
              filter === 'solidarity'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-600 dark:border-amber-600'
                : 'border-stone-200 dark:border-slate-700'
            }`}
          >
            Boutique Solidaire
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="px-3.5 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un article
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-300">
          {message}
        </div>
      )}

      {showNew && canManage && (
        <form
          onSubmit={createProduct}
          className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold">Nouvel article marketplace</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              required
              placeholder="Titre du produit"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="text"
              placeholder="Catégorie"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="number"
              required
              min={100}
              placeholder="Prix (XOF)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="number"
              required
              min={0}
              placeholder="Stock disponible"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
          </div>
          <textarea
            required
            rows={2}
            placeholder="Description de l'article"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isSolidarityProduct}
              onChange={(e) => setIsSolidarityProduct(e.target.checked)}
            />
            Article Solidaire (recettes affectées au fonds humanitaire)
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-4 py-2 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
            >
              Publier
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleProducts.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
            >
              <div className="h-40 bg-stone-100 dark:bg-slate-800">
                <ResilientImage
                  src={p.imageUrl}
                  alt={p.title}
                  fallbackLabel={p.category}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-stone-500 dark:text-slate-400">
                    <span>{p.category}</span>
                    <span className={p.isSolidarityProduct ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : ''}>
                      {p.isSolidarityProduct ? 'Fonds Solidaire' : 'Fonds Commercial'}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-semibold text-stone-900 dark:text-white">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-stone-600 dark:text-slate-400 line-clamp-3">
                    {p.description}
                  </p>
                </div>
                <div className="pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-mono-tabular text-lg font-bold text-stone-900 dark:text-white">
                      {p.price.toLocaleString('fr-FR')} {p.currency}
                    </p>
                    <p className="text-[11px] text-stone-500">Stock : {p.stockQuantity}</p>
                  </div>
                  <button
                    type="button"
                    disabled={p.stockQuantity < 1}
                    onClick={() => setSelectedProduct(p)}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Commander
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProduct && (
        <form
          onSubmit={placeOrder}
          className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-slate-900 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Commander : {selectedProduct.title}</h3>
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="text-xs text-stone-500 hover:underline cursor-pointer"
            >
              Fermer
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Quantité</label>
              <input
                type="number"
                min={1}
                max={selectedProduct.stockQuantity}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Moyen de paiement</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                {PAYMENT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
                {canManage && <option value="cash">Espèces (Guichet Trésorerie)</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Adresse ou point de retrait</label>
              <input
                type="text"
                required
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs font-mono-tabular font-semibold">
              Total : {(selectedProduct.price * Math.max(1, Number(qty))).toLocaleString('fr-FR')}{' '}
              {selectedProduct.currency} (Affectation :{' '}
              {selectedProduct.isSolidarityProduct ? 'Fonds Humanitaire' : 'Fonds Commercial'})
            </p>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
            >
              Valider la commande
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
          Suivi des commandes ({orders.length})
        </h3>
        {orders.length === 0 ? (
          <p className="text-xs text-stone-500">Aucune commande enregistrée.</p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-slate-800">
            {orders.map((o) => (
              <div key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-mono-tabular font-semibold text-stone-900 dark:text-white">
                    {o.paymentReference} · {o.totalAmount.toLocaleString('fr-FR')} {o.currency}
                  </p>
                  <p className="text-stone-500 dark:text-slate-400">
                    {o.buyerName} · {o.items.map((i) => `${i.titleSnapshot} (x${i.quantity})`).join(', ')} · Fonds {o.fundType}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular px-2 py-0.5 rounded border border-stone-200 dark:border-slate-700">
                    {o.status}
                  </span>
                  {canManage && o.status === 'paid' && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(o.id, 'shipped')}
                      className="px-2.5 py-1 rounded border border-stone-200 dark:border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Truck className="w-3 h-3" />
                      Expédier
                    </button>
                  )}
                  {canManage && o.status === 'shipped' && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(o.id, 'delivered')}
                      className="px-2.5 py-1 rounded border border-emerald-300 text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <PackageCheck className="w-3 h-3" />
                      Livré
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
