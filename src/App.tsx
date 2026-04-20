import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { 
  ShoppingCart, LayoutDashboard, PackageSearch, Receipt, LogOut, 
  Plus, Search, Trash2, Edit, Barcode, CreditCard, Banknote,
  TrendingUp, AlertCircle, CheckCircle2, Lock, UserCog, ShieldCheck,
  History, Save, X, Store as StoreIcon
} from 'lucide-react';

// ============================================================================
// 1. CAPA DE DOMINIO (Modelos y Tipos)
// ============================================================================

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';
export type PaymentMethod = 'CASH' | 'CARD';
export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER';

export interface Tenant {
  id: string;
  name: string;
  plan: 'BASIC' | 'PRO' | 'PREMIUM';
}

export interface Store {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
}

export interface User {
  id: string;
  tenantId: string;
  storeId: string;
  username: string;
  name: string;
  role: Role;
}

export interface Product {
  id: string;
  tenantId: string;
  barcode: string;
  name: string;
  category: string;
  cost: number;
  price: number;
}

export interface StoreProduct {
  id: string;
  tenantId: string;
  storeId: string;
  productId: string;
  stock: number;
  minStock: number;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  price: number;
  cost: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  tenantId: string;
  storeId: string;
  cashierId: string;
  datetime: string;
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  changeAmount: number;
  itemsCount?: number;
  items?: (SaleItem & { name?: string })[];
}

export interface StockMovement {
  id: string;
  tenantId: string;
  storeId: string;
  productId: string;
  userId: string;
  type: MovementType;
  quantity: number;
  date: string;
  reason?: string;
}

// Vista combinada para el frontend
export type ProductView = Product & { stock: number; minStock: number };

function hasFeature(tenant: Tenant | null, feature: 'MULTISTORE' | 'AUDIT' | 'OFFLINE') {
  if (!tenant) return false;
  const planFeatures = {
    BASIC: ['POS', 'INVENTORY'],
    PRO: ['POS', 'INVENTORY', 'MULTISTORE', 'AUDIT'],
    PREMIUM: ['POS', 'INVENTORY', 'MULTISTORE', 'AUDIT', 'OFFLINE', 'API'],
  };
  return (planFeatures[tenant.plan] as any)?.includes(feature) ?? false;
}

// ============================================================================
// 2. CAPA DE INFRAESTRUCTURA (Simulación de Backend)
// ============================================================================

let DB = {
  tenants: [
    { id: 't1', name: 'Mi Empresa SA', plan: 'PRO' } as Tenant
  ],
  stores: [
    { id: 's1', tenantId: 't1', name: 'Sucursal Principal', address: 'Centro' } as Store,
    { id: 's2', tenantId: 't1', name: 'Sucursal Norte', address: 'Norte' } as Store,
  ],
  users: [
    { id: 'u1', tenantId: 't1', storeId: 's1', username: 'admin', name: 'Administrador', role: 'ADMIN' },
    { id: 'u2', tenantId: 't1', storeId: 's1', username: 'caja1', name: 'Juan Pérez', role: 'CASHIER' }
  ] as User[],
  products: [
    { id: 'p1', tenantId: 't1', barcode: '75010001', name: 'Leche Entera Alpura 1L', category: 'Lácteos', cost: 18.5, price: 25.0 },
    { id: 'p2', tenantId: 't1', barcode: '75010002', name: 'Pan Bimbo Blanco', category: 'Panadería', cost: 30.0, price: 42.0 },
    { id: 'p3', tenantId: 't1', barcode: '75010003', name: 'Coca-Cola 600ml', category: 'Bebidas', cost: 11.0, price: 18.0 },
  ] as Product[],
  storeProducts: [
    { id: 'sp1', tenantId: 't1', storeId: 's1', productId: 'p1', stock: 45, minStock: 10 },
    { id: 'sp2', tenantId: 't1', storeId: 's1', productId: 'p2', stock: 12, minStock: 15 },
    { id: 'sp3', tenantId: 't1', storeId: 's1', productId: 'p3', stock: 120, minStock: 24 },
  ] as StoreProduct[],
  sales: [] as Sale[],
  saleItems: [] as SaleItem[],
  movements: [] as StockMovement[]
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const BackendAPI = {
  async login(username: string, pin: string): Promise<{ user: User, tenant: Tenant, store: Store, token: string }> {
    await delay(300);
    const user = DB.users.find(u => u.username === username);
    if (user && ((username === 'admin' && pin === '1234') || (username === 'caja1' && pin === '0000'))) {
      const tenant = DB.tenants.find(t => t.id === user.tenantId)!;
      const store = DB.stores.find(s => s.id === user.storeId)!;
      return { user, tenant, store, token: 'simulated_jwt_token' };
    }
    throw new Error('Credenciales inválidas');
  },

  async getStoreProducts(context: { tenantId: string, storeId: string }): Promise<ProductView[]> {
    await delay(200);
    const tProducts = DB.products.filter(p => p.tenantId === context.tenantId);
    const sproducts = DB.storeProducts.filter(sp => sp.tenantId === context.tenantId && sp.storeId === context.storeId);
    
    return tProducts.map(p => {
      const sp = sproducts.find(s => s.productId === p.id);
      return {
        ...p,
        stock: sp ? sp.stock : 0,
        minStock: sp ? sp.minStock : 0
      };
    });
  },

  async saveProduct(context: { tenantId: string, storeId: string, userId: string }, productData: Omit<ProductView, 'id' | 'tenantId'> | ProductView): Promise<ProductView> {
    await delay(300);
    const isNew = !('id' in productData) || !productData.id;
    
    if (isNew) {
      const newProduct: Product = {
        id: `p${Date.now()}`,
        tenantId: context.tenantId,
        barcode: productData.barcode,
        name: productData.name,
        category: productData.category,
        cost: productData.cost,
        price: productData.price
      };
      DB.products.push(newProduct);
      
      const newSp: StoreProduct = {
        id: `sp${Date.now()}`,
        tenantId: context.tenantId,
        storeId: context.storeId,
        productId: newProduct.id,
        stock: productData.stock,
        minStock: productData.minStock
      };
      DB.storeProducts.push(newSp);

      if (newSp.stock > 0) {
        DB.movements.push({
          id: `m${Date.now()}`, tenantId: context.tenantId, storeId: context.storeId,
          productId: newProduct.id, userId: context.userId, type: 'PURCHASE',
          quantity: newSp.stock, date: new Date().toISOString(), reason: 'Inventario Inicial'
        });
      }
      return { ...newProduct, stock: newSp.stock, minStock: newSp.minStock };
    } else {
      const pId = (productData as ProductView).id;
      const indexP = DB.products.findIndex(p => p.id === pId && p.tenantId === context.tenantId);
      if (indexP === -1) throw new Error('Producto no encontrado');
      
      DB.products[indexP] = { 
        ...DB.products[indexP], 
        barcode: productData.barcode, name: productData.name, category: productData.category,
        cost: productData.cost, price: productData.price
      };

      let spIndex = DB.storeProducts.findIndex(sp => sp.productId === pId && sp.storeId === context.storeId && sp.tenantId === context.tenantId);
      
      if (spIndex === -1) {
         // Create if missing for this store
         const newSp: StoreProduct = {
          id: `sp${Date.now()}`, tenantId: context.tenantId, storeId: context.storeId,
          productId: pId, stock: productData.stock, minStock: productData.minStock
        };
        DB.storeProducts.push(newSp);
        spIndex = DB.storeProducts.length - 1;
      }
      
      const oldStock = DB.storeProducts[spIndex].stock;
      DB.storeProducts[spIndex] = { ...DB.storeProducts[spIndex], stock: productData.stock, minStock: productData.minStock };

      if (oldStock !== productData.stock) {
        DB.movements.push({
          id: `m${Date.now()}`, tenantId: context.tenantId, storeId: context.storeId,
          productId: pId, userId: context.userId, type: 'ADJUSTMENT',
          quantity: productData.stock - oldStock, date: new Date().toISOString(), reason: 'Ajuste manual'
        });
      }

      return { ...DB.products[indexP], stock: productData.stock, minStock: productData.minStock };
    }
  },

  async processSale(context: { tenantId: string, storeId: string, userId: string }, saleData: { items: (ProductView & { quantity: number })[], paymentMethod: PaymentMethod, amountTendered: number }): Promise<Sale> {
    await delay(400);
    
    // 1. Validaciones de stock
    for (const item of saleData.items) {
      const sp = DB.storeProducts.find(sp => sp.productId === item.id && sp.storeId === context.storeId && sp.tenantId === context.tenantId);
      if (!sp || sp.stock < item.quantity) throw new Error(`Stock insuficiente para ${item.name}`);
    }

    const total = saleData.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    
    const newSale: Sale = {
      id: `TRX-${Date.now().toString().slice(-6)}`,
      tenantId: context.tenantId,
      storeId: context.storeId,
      cashierId: context.userId,
      datetime: new Date().toISOString(),
      total,
      paymentMethod: saleData.paymentMethod,
      amountTendered: saleData.amountTendered,
      changeAmount: saleData.amountTendered - total,
      itemsCount: saleData.items.reduce((acc, i) => acc + i.quantity, 0)
    };
    DB.sales.push(newSale);

    saleData.items.forEach(item => {
      const saleItem: SaleItem = {
        id: `si${Date.now()}${Math.random()}`,
        saleId: newSale.id,
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost,
        subtotal: item.price * item.quantity
      };
      DB.saleItems.push(saleItem);

      const sp = DB.storeProducts.find(sp => sp.productId === item.id && sp.storeId === context.storeId && sp.tenantId === context.tenantId)!;
      sp.stock -= item.quantity;

      DB.movements.push({
        id: `m${Date.now()}-${item.id}`,
        tenantId: context.tenantId,
        storeId: context.storeId,
        productId: item.id,
        userId: context.userId,
        type: 'SALE',
        quantity: -item.quantity,
        date: newSale.datetime,
        reason: `Venta ${newSale.id}`
      });
    });

    return newSale;
  },

  async getSales(context: { tenantId: string, storeId?: string }): Promise<Sale[]> {
    await delay(200);
    let s = DB.sales.filter(s => s.tenantId === context.tenantId);
    if (context.storeId) s = s.filter(x => x.storeId === context.storeId);
    
    // Inyectamos algunos sale items para visualizacion
    return s.sort((a,b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()).map(sale => {
      const items = DB.saleItems.filter(si => si.saleId === sale.id).map(si => ({
        ...si,
        name: DB.products.find(p => p.id === si.productId)?.name || 'Desconocido'
      }));
      return { ...sale, items };
    });
  },

  async getStockMovements(context: { tenantId: string, storeId?: string }): Promise<(StockMovement & { productName: string, userName: string })[]> {
    await delay(200);
    let m = DB.movements.filter(m => m.tenantId === context.tenantId);
    if (context.storeId) m = m.filter(x => x.storeId === context.storeId);
    
    return m.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(mov => ({
      ...mov,
      productName: DB.products.find(p => p.id === mov.productId)?.name || 'N/A',
      userName: DB.users.find(u => u.id === mov.userId)?.name || 'N/A'
    }));
  }
};

// ============================================================================
// 3. ESTADO GLOBAL (AuthContext)
// ============================================================================

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  store: Store | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  hasPermission: (roles: Role[]) => boolean;
  reqContext: { tenantId: string, storeId: string, userId: string };
}

const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ============================================================================
// 4. APP COMPONENT
// ============================================================================

export default function App() {
  const [session, setSession] = useState<{ user: User, tenant: Tenant, store: Store, token: string } | null>(null);
  
  const login = async (username: string, pin: string) => {
    const data = await BackendAPI.login(username, pin);
    setSession(data);
  };
  
  const logout = () => setSession(null);
  
  const hasPermission = (roles: Role[]) => {
    return session ? roles.includes(session.user.role) : false;
  };

  const reqContext = useMemo(() => session ? {
    tenantId: session.tenant.id,
    storeId: session.store.id,
    userId: session.user.id
  } : { tenantId: '', storeId: '', userId: '' }, [session]);

  const authValue = {
    user: session?.user || null,
    tenant: session?.tenant || null,
    store: session?.store || null,
    login, logout, hasPermission, reqContext
  };

  if (!session) {
    return <AuthContext.Provider value={authValue}><LoginScreen /></AuthContext.Provider>;
  }

  return (
    <AuthContext.Provider value={authValue}>
      <MainLayout />
    </AuthContext.Provider>
  );
}

// ============================================================================
// 5. LAYOUT Y NAVEGACIÓN
// ============================================================================

function MainLayout() {
  const { user, tenant, store, logout, hasPermission } = useAuth();
  const [currentView, setCurrentView] = useState<'pos' | 'dashboard' | 'inventory' | 'sales' | 'movements'>('pos');
  
  const auditEnabled = hasFeature(tenant, 'AUDIT');

  return (
    <div className="flex h-screen bg-[#0F1115] font-sans text-[#E2E8F0] overflow-hidden">
      <aside className="w-64 bg-[#111419] border-r border-[#2D3139] flex flex-col transition-all duration-300">
        <div className="p-6 flex items-center gap-3 border-b border-[#2D3139] bg-[#16191E]">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg border border-white/10 shrink-0">
            N
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">NEXUS <span className="font-light text-slate-400 text-sm italic">v2.0</span></h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase font-bold truncate max-w-[120px]">Plan {tenant?.plan}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#16191E] border-b border-[#2D3139] space-y-3 flex justify-between flex-col">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-800 border border-white/10 flex items-center justify-center shrink-0">
              {user?.role === 'ADMIN' ? <ShieldCheck size={20} className="text-white"/> : <UserCog size={20} className="text-white"/>}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{user?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-black/20 p-2 border border-white/5 rounded-lg">
            <StoreIcon size={14} className="text-blue-500 shrink-0" />
            <span className="truncate">{store?.name}</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto flex flex-col gap-1">
          <div className="px-4 py-2 text-[10px] text-slate-600 uppercase font-bold tracking-[0.2em] mb-1">Operaciones</div>
          <NavItem icon={<ShoppingCart size={20} />} label="Terminal de Caja" active={currentView === 'pos'} onClick={() => setCurrentView('pos')} />
          
          {hasPermission(['ADMIN', 'MANAGER']) && (
            <>
              <div className="px-4 py-2 text-[10px] text-slate-600 uppercase font-bold tracking-[0.2em] mt-4 mb-1">Management</div>
              <NavItem icon={<LayoutDashboard size={20} />} label="Panel de Control" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
              <NavItem icon={<PackageSearch size={20} />} label="Inventario y Stock" active={currentView === 'inventory'} onClick={() => setCurrentView('inventory')} />
              
              {auditEnabled && (
                <>
                  <div className="px-4 py-2 text-[10px] text-slate-600 uppercase font-bold tracking-[0.2em] mt-4 mb-1">Auditoría</div>
                  <NavItem icon={<Receipt size={20} />} label="Registro de Ventas" active={currentView === 'sales'} onClick={() => setCurrentView('sales')} />
                  <NavItem icon={<History size={20} />} label="Auditoría Movimientos" active={currentView === 'movements'} onClick={() => setCurrentView('movements')} />
                </>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[#2D3139]">
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 w-full rounded-lg hover:bg-white/5 text-slate-400 transition-colors font-medium">
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {currentView === 'pos' && <POSView />}
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'inventory' && <InventoryView />}
        {currentView === 'sales' && <SalesView />}
        {currentView === 'movements' && <MovementsView />}
      </main>
    </div>
  );
}

// ============================================================================
// 6. LOGIN
// ============================================================================

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(username, pin);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E2E8F0] font-sans flex items-center justify-center p-4">
      <div className="bg-[#1A1D23] p-8 rounded-3xl shadow-xl w-full max-w-md border border-[#2D3139]">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 text-white p-4 rounded-2xl mb-4 shadow-lg shrink-0 border border-white/10">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">NEXUS Auth 2.0</h1>
          <p className="text-slate-400 text-center mt-2 text-sm max-w-xs">
            Ingresa credenciales.
            <br/> <span className="font-mono text-xs text-slate-500">admin/1234 | caja1/0000</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 bg-[#0F1115] border border-[#2D3139] text-[#E2E8F0] rounded-xl outline-none focus:border-blue-500 transition-colors" placeholder="Usuario" autoFocus />
          <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" className="w-full text-center tracking-[1em] text-2xl p-3 bg-[#0F1115] border border-[#2D3139] text-white rounded-xl outline-none focus:border-blue-500 transition-colors" maxLength={4} />
          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors">{loading ? 'Verificando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 7. PUNTO DE VENTA
// ============================================================================

function POSView() {
  const { reqContext } = useAuth();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [cart, setCart] = useState<(ProductView & { quantity: number, subtotal: number })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    BackendAPI.getStoreProducts(reqContext).then(setProducts);
  }, [reqContext]);

  const filteredProducts = useMemo(() => products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery)
  ), [products, searchQuery]);

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const addToCart = (product: ProductView) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id 
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price } : item);
      }
      return [...prev, { ...product, quantity: 1, subtotal: product.price }];
    });
    setSearchQuery('');
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) { setCart(prev => prev.filter(i => i.id !== id)); return; }
    const p = products.find(x => x.id === id);
    if (!p || newQuantity > p.stock) return;
    setCart(prev => prev.map(item => item.id === id 
      ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price } : item));
  };

  const handleCheckout = async (paymentMethod: PaymentMethod, amountTendered: number) => {
    setIsProcessing(true);
    try {
      await BackendAPI.processSale(reqContext, {
        items: cart,
        paymentMethod,
        amountTendered
      });
      setCart([]);
      setShowPaymentModal(false);
      const updated = await BackendAPI.getStoreProducts(reqContext);
      setProducts(updated);
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full bg-[#0F1115] relative">
      {isProcessing && (
        <div className="absolute inset-0 bg-[#0F1115]/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-[#1A1D23] border border-[#2D3139] p-6 rounded-2xl shadow-xl text-blue-400 font-bold">Procesando...</div>
        </div>
      )}

      <div className="flex-1 flex flex-col p-6 h-full overflow-hidden">
        <div className="bg-[#1A1D23] p-4 rounded-2xl shadow-sm border border-[#2D3139] mb-6 flex items-center gap-4">
          <Barcode size={24} className="text-slate-500" />
          <input
            type="text" placeholder="Buscar..." className="flex-1 text-lg outline-none bg-transparent text-white"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-20">
            {filteredProducts.map(product => (
              <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0}
                className={`text-left p-4 rounded-xl border transition-all ${product.stock <= 0 ? 'bg-[#1A1D23] opacity-50 border-[#2D3139]' : 'bg-[#1A1D23] border-[#2D3139] hover:border-blue-500 hover:bg-white/5'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{product.category}</span>
                  {product.stock <= product.minStock && product.stock > 0 && <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Stock: {product.stock}</span>}
                  {product.stock <= 0 && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Agotado</span>}
                </div>
                <h3 className="font-bold text-sm h-10 text-white">{product.name}</h3>
                <div className="flex justify-between items-end mt-2">
                  <span className="text-slate-500 font-mono text-[10px]">{product.barcode}</span>
                  <span className="font-bold text-blue-400">{formatCurrency(product.price)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-96 bg-[#111419] border-l border-[#2D3139] flex flex-col shadow-2xl z-10">
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {cart.map(item => (
            <div key={item.id} className="flex gap-3 bg-[#1A1D23] p-3 border border-[#2D3139] rounded-xl text-white">
              <div className="flex flex-col items-center bg-black/20 rounded-lg p-1 border border-white/5">
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:text-blue-400 transition-colors"><Plus size={14} /></button>
                <span className="font-bold text-sm my-1">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <h4 className="font-bold text-sm">{item.name}</h4>
                <span className="text-slate-500 text-xs">{formatCurrency(item.price)} c/u</span>
              </div>
              <div className="font-black flex items-center text-blue-400">{formatCurrency(item.subtotal)}</div>
            </div>
          ))}
          {!cart.length && <div className="h-full flex items-center justify-center text-slate-500">Carrito vacío</div>}
        </div>
        <div className="p-6 bg-[#16191E] border-t border-[#2D3139] rounded-t-xl">
          <div className="flex justify-between text-3xl font-mono tracking-tight mb-4 text-white">
            <span className="font-sans">Total</span>
            <span className="text-blue-500">{formatCurrency(cartTotal)}</span>
          </div>
          <button onClick={() => setShowPaymentModal(true)} disabled={!cart.length}
            className="w-full py-4 rounded-xl font-bold bg-blue-600 text-white disabled:bg-white/5 disabled:text-slate-600 transition-colors">Cobrar</button>
        </div>
      </div>

      {showPaymentModal && <PaymentModal total={cartTotal} onClose={() => setShowPaymentModal(false)} onComplete={handleCheckout} />}
    </div>
  );
}

function PaymentModal({ total, onClose, onComplete }: any) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tendered, setTendered] = useState(total.toString());
  const tenderNum = parseFloat(tendered) || 0;
  const change = tenderNum - total;
  const isInvalid = method === 'CASH' && tenderNum < total;

  return (
    <div className="fixed inset-0 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1A1D23] border border-[#2D3139] rounded-2xl overflow-hidden w-full max-w-md">
        <div className="bg-[#16191E] p-6 text-white border-b border-[#2D3139] text-center"><div className="text-5xl font-mono tracking-tight text-blue-500">{formatCurrency(total)}</div></div>
        <div className="p-6 space-y-6 text-[#E2E8F0]">
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setMethod('CASH'); setTendered(total.toString()); }} className={`p-4 border rounded-xl font-bold transition-colors ${method==='CASH'?'border-blue-500 bg-blue-600/10 text-blue-400':'border-[#2D3139] text-slate-500 hover:bg-white/5'}`}>EFECTIVO</button>
            <button onClick={() => { setMethod('CARD'); setTendered(total.toString()); }} className={`p-4 border rounded-xl font-bold transition-colors ${method==='CARD'?'border-blue-500 bg-blue-600/10 text-blue-400':'border-[#2D3139] text-slate-500 hover:bg-white/5'}`}>TARJETA</button>
          </div>
          {method === 'CASH' && (
            <div>
              <input type="number" value={tendered} onChange={e => setTendered(e.target.value)} className="w-full text-right text-3xl font-mono p-3 bg-[#0F1115] border border-[#2D3139] rounded-xl focus:border-blue-500 outline-none text-white transition-colors" onFocus={e => e.target.select()}/>
              <div className="flex justify-between mt-4"><span>Cambio</span><span className="font-mono text-2xl text-white">{formatCurrency(change>0?change:0)}</span></div>
            </div>
          )}
          <div className="flex gap-4">
            <button onClick={onClose} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors">Cancelar</button>
            <button onClick={() => onComplete(method, tenderNum)} disabled={isInvalid} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:bg-white/5 disabled:text-slate-600 transition-colors">Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 8. INVENTARIO
// ============================================================================

function InventoryView() {
  const { reqContext } = useAuth();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<any>(null);

  const loadData = () => BackendAPI.getStoreProducts(reqContext).then(setProducts);
  useEffect(() => { loadData(); }, []);

  const handleSave = async (data: any) => {
    try {
      await BackendAPI.saveProduct(reqContext, data);
      await loadData();
      setIsEditing(null);
    } catch (e:any) { alert(e.message); }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search));

  return (
    <div className="p-8 h-full flex flex-col bg-[#0F1115] relative text-[#E2E8F0]">
      {isEditing && <ProductFormModal product={isEditing} onClose={() => setIsEditing(null)} onSave={handleSave} />}
      <div className="flex justify-between items-end mb-8">
        <div><h2 className="text-xl font-bold text-white tracking-tight">Inventario de Catálogo</h2></div>
        <button onClick={() => setIsEditing({category: 'Abarrotes', stock: 0, minStock: 5})} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"><Plus size={18}/> Nuevo</button>
      </div>
      <div className="bg-[#1A1D23] flex-1 rounded-xl shadow-sm border border-[#2D3139] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#2D3139]">
          <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full max-w-md px-4 py-2 bg-[#0F1115] border border-[#2D3139] text-white rounded-lg outline-none focus:border-blue-500 transition-colors"/>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-[#2D3139] text-slate-400 sticky top-0 uppercase font-bold text-[10px] tracking-widest">
              <tr><th className="px-6 py-4">SKU / Código</th><th className="px-6 py-4">Producto</th><th className="px-6 py-4">Precio</th><th className="px-6 py-4 text-center">Stock</th><th className="px-6 py-4 text-center">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-[#2D3139]">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors text-slate-300">
                  <td className="px-6 py-4 font-mono text-slate-500 text-xs">{p.barcode}</td>
                  <td className="px-6 py-4 font-medium text-white">{p.name} <span className="text-[10px] text-slate-500 block">{p.category}</span></td>
                  <td className="px-6 py-4 font-mono text-blue-400">{formatCurrency(p.price)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold border ${p.stock <= p.minStock ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-white/5 text-slate-400 border-white/10'}`}>{p.stock}</span>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-400"><button onClick={() => setIsEditing(p)} className="p-2 hover:text-blue-400 transition-colors"><Edit size={16}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductFormModal({ product, onClose, onSave }: any) {
  const [data, setData] = useState(product);
  const [loading, setLoading] = useState(false);
  const submit = async (e: any) => {
    e.preventDefault(); setLoading(true);
    await onSave({ ...data, cost: Number(data.cost), price: Number(data.price), stock: Number(data.stock), minStock: Number(data.minStock) });
    setLoading(false);
  }
  return (
    <div className="fixed inset-0 bg-[#0F1115]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-[#1A1D23] border border-[#2D3139] rounded-2xl w-full max-w-xl p-6 text-[#E2E8F0]">
        <h2 className="text-xl font-bold text-white tracking-tight mb-4">{product.id ? 'Editar' : 'Nuevo'} Producto</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <input required placeholder="Código" value={data.barcode||''} onChange={e=>setData({...data, barcode: e.target.value})} className="p-3 bg-[#0F1115] border border-[#2D3139] text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required placeholder="Categoría" value={data.category||''} onChange={e=>setData({...data, category: e.target.value})} className="p-3 bg-[#0F1115] border border-[#2D3139] text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required placeholder="Nombre" value={data.name||''} onChange={e=>setData({...data, name: e.target.value})} className="col-span-2 p-3 bg-[#0F1115] border border-[#2D3139] text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" step="0.01" placeholder="Costo" value={data.cost||''} onChange={e=>setData({...data, cost: e.target.value})} className="p-3 bg-[#0F1115] border border-[#2D3139] text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" step="0.01" placeholder="Precio" value={data.price||''} onChange={e=>setData({...data, price: e.target.value})} className="p-3 bg-[#0F1115] border border-[#2D3139] text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" placeholder="Stock" value={data.stock||0} onChange={e=>setData({...data, stock: e.target.value})} className="p-3 bg-[#0F1115] border border-[#2D3139] text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" placeholder="Min Stock" value={data.minStock||0} onChange={e=>setData({...data, minStock: e.target.value})} className="p-3 bg-[#0F1115] border border-[#2D3139] text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-white/5 disabled:text-slate-600 text-white rounded-xl font-bold transition-colors">Guardar</button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 9. DASHBOARD Y REPORTES
// ============================================================================

function DashboardView() {
  const { reqContext } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);

  useEffect(() => {
    BackendAPI.getSales({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(setSales);
    BackendAPI.getStoreProducts(reqContext).then(setProducts);
  }, [reqContext]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = sales.reduce((sum, sale) => sum + (sale.items?.reduce((c, i) => c + (i.cost * i.quantity), 0) || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const iv = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);

  return (
    <div className="p-8 h-full overflow-y-auto bg-[#0F1115] text-[#E2E8F0] flex flex-col gap-6">
      <h2 className="text-xl font-bold tracking-tight text-white">Dashboard Múlti-tenant</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Ingresos (Store)" value={formatCurrency(totalRevenue)} icon={<Banknote size={20}/>} color="bg-blue-500" />
        <StatCard title="Ganancia Neta" value={formatCurrency(totalProfit)} icon={<TrendingUp size={20}/>} color="bg-emerald-500" />
        <StatCard title="Inventario Value" value={formatCurrency(iv)} icon={<PackageSearch size={20}/>} color="bg-purple-500" />
        <StatCard title="Ventas Totales" value={sales.length} icon={<Receipt size={20}/>} color="bg-amber-500" />
      </div>

      <div className="mt-2 flex items-center justify-center p-4 border border-dashed border-[#2D3139] rounded-xl bg-white/5">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Resumen General Actualizado Automáticamente</span>
      </div>
    </div>
  );
}

function SalesView() {
  const { reqContext } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  useEffect(() => { BackendAPI.getSales({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(setSales); }, [reqContext]);

  return (
    <div className="p-8 h-full flex flex-col bg-[#0F1115] text-[#E2E8F0] gap-6">
      <h2 className="text-xl font-bold tracking-tight text-white">Registro de Ventas</h2>
      <div className="bg-[#1A1D23] flex-1 rounded-xl shadow-sm border border-[#2D3139] overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 border-b border-[#2D3139] uppercase text-[10px] tracking-widest text-slate-400">
            <tr><th className="px-6 py-4">ID Transacción</th><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Método</th><th className="px-6 py-4">Total</th><th className="px-6 py-4 text-center">Items</th></tr>
          </thead>
          <tbody className="divide-y divide-[#2D3139]">
            {sales.map(s => (
              <tr key={s.id} className="hover:bg-white/5 transition-colors text-slate-300">
                <td className="px-6 py-4 font-mono text-slate-500 text-xs">{s.id}</td>
                <td className="px-6 py-4 text-slate-400">{new Date(s.datetime).toLocaleString()}</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-white/5 text-slate-400 text-[10px] font-bold rounded border border-white/10 uppercase">{s.paymentMethod}</span></td>
                <td className="px-6 py-4 font-mono text-blue-400 font-bold">{formatCurrency(s.total)}</td>
                <td className="px-6 py-4 text-center text-slate-400">{s.itemsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MovementsView() {
  const { reqContext } = useAuth();
  const [moves, setMoves] = useState<any[]>([]);
  useEffect(() => { BackendAPI.getStockMovements({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(setMoves); }, [reqContext]);
  
  return (
    <div className="p-8 h-full flex flex-col bg-[#0F1115] text-[#E2E8F0] gap-6">
      <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">Auditoría <span className="text-xs font-normal text-slate-500">• Store Movements</span></h2>
      <div className="bg-[#111419] flex-1 rounded-xl shadow-sm border border-[#2D3139] p-4 flex flex-col gap-4 overflow-y-auto">
        {moves.map(m => (
          <div key={m.id} className="flex gap-4 group">
            <div className={`w-1 rounded-full ${m.quantity > 0 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase text-slate-500 tracking-tight">{m.type} • {m.productName}</div>
              <div className="text-sm text-slate-300">
                Quantity adjusted by <span className={m.quantity > 0 ? 'text-blue-400' : 'text-red-400'}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span> units
              </div>
              <div className="text-[10px] text-slate-600 font-medium mt-1">By user: {m.userName} • {new Date(m.date).toLocaleString()} • {m.reason}</div>
            </div>
          </div>
        ))}
        {moves.length === 0 && <div className="text-slate-500 text-sm mt-4 italic text-center">No movements recorded yet.</div>}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTES COMUNES
// ============================================================================
function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${active ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-none' : 'text-slate-400 hover:bg-white/5 border border-transparent'}`}>
      {icon} {label}
    </button>
  );
}

function StatCard({ icon, title, value, color }: any) {
  return (
    <div className="bg-[#1A1D23] p-5 border border-[#2D3139] rounded-xl flex flex-col justify-between">
      <div className={`text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 flex items-center justify-between`}>
        {title}
        <div className={`p-1.5 rounded-lg bg-black/20 text-blue-400`}>{icon}</div>
      </div>
      <h4 className="text-2xl font-mono text-white tracking-tight">{value}</h4>
    </div>
  );
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
