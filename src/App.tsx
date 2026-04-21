import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  ShoppingCart, LayoutDashboard, PackageSearch, Receipt, LogOut, 
  Plus, Search, Trash2, Edit, Barcode, CreditCard, Banknote,
  TrendingUp, AlertCircle, CheckCircle2, Lock, UserCog, ShieldCheck,
  History, Save, X, Store as StoreIcon, Sun, Moon, Upload, Menu,
  Printer, QrCode, CloudOff, CloudUpload, WifiOff
} from 'lucide-react';

import {
  Id, ISODateString, Money, Role, Plan, PaymentMethod, MovementType, Feature,
  Tenant, Store, User, Product, StoreProduct, SaleItem, Sale, StockMovement,
  ProductView, SaleItemWithName, StockMovementView, Session, RequestContext,
  CreateProductInput, UpdateProductInput, CartItem, ProcessSaleInput, LoginInput, LoginResponse
} from './types';

// ============================================================================
// 1. UTILIDADES Y CONSTANTES
// ============================================================================

function hasFeature(tenant: Tenant | null, feature: Feature) {
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
    { id: 't1', name: 'Mi Empresa SA', plan: 'PREMIUM' } as Tenant
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
  async login(username: string, pin: string): Promise<LoginResponse> {
    await delay(300);
    const user = DB.users.find(u => u.username === username);
    if (user && ((username === 'admin' && pin === '1234') || (username === 'caja1' && pin === '0000'))) {
      const tenant = DB.tenants.find(t => t.id === user.tenantId)!;
      const store = DB.stores.find(s => s.id === user.storeId)!;
      return { user, tenant, store, token: 'simulated_jwt_token' };
    }
    throw new Error('Credenciales inválidas');
  },

  async deleteProduct(context: RequestContext, productId: string): Promise<void> {
    await delay(300);
    DB.products = DB.products.filter(p => !(p.id === productId && p.tenantId === context.tenantId));
    DB.storeProducts = DB.storeProducts.filter(sp => !(sp.productId === productId && sp.tenantId === context.tenantId));
  },

  async getStoreProducts(context: RequestContext): Promise<ProductView[]> {
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

  async saveProduct(context: RequestContext, productData: CreateProductInput | UpdateProductInput): Promise<ProductView> {
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

  async saveProductsBulk(context: RequestContext, productsData: CreateProductInput[]): Promise<void> {
    await delay(500);
    for (const data of productsData) {
      // Small delay per item to avoid blocking entirely or just await the sequential wrapper
      await this.saveProduct(context, data);
    }
  },

  async processSale(context: RequestContext, saleData: ProcessSaleInput): Promise<Sale> {
    await delay(400);
    
    // 1. Validaciones de stock
    if (!saleData.isOfflineSync) {
      for (const item of saleData.items) {
        const sp = DB.storeProducts.find(sp => sp.productId === item.id && sp.storeId === context.storeId && sp.tenantId === context.tenantId);
        if (!sp || sp.stock < item.quantity) throw new Error(`Stock insuficiente para ${item.name}`);
      }
    }

    const total = saleData.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    
    const newSale: Sale = {
      id: `TRX-${Date.now().toString().slice(-6)}`,
      tenantId: context.tenantId,
      storeId: context.storeId,
      cashierId: context.userId,
      datetime: saleData.offlineDate || new Date().toISOString(),
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

  async getSales(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<Sale[]> {
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

  async getStockMovements(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<StockMovementView[]> {
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
  reqContext: RequestContext;
}

const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ============================================================================
// 3.5 THEME CONTEXT
// ============================================================================


interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function useThemeProvider() {
  // Always start in dark mode as requested for "Elegant Dark"
  const [isDark, setIsDark] = useState(true);
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return { isDark, toggleTheme: () => setIsDark(!isDark) };
}

function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}

// ============================================================================
// 4. APP COMPONENT
// ============================================================================

export default function App() {
  const [session, setSession] = useState<{ user: User, tenant: Tenant, store: Store, token: string } | null>(null);
  const themeData = useThemeProvider();
  
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
    return (
      <ThemeContext.Provider value={themeData}>
        <AuthContext.Provider value={authValue}>
          <LoginScreen />
        </AuthContext.Provider>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={themeData}>
      <AuthContext.Provider value={authValue}>
        <MainLayout />
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}

// ============================================================================
// 5. LAYOUT Y NAVEGACIÓN
// ============================================================================

function SyncManager() {
  const { tenant } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const checkPending = () => {
    const existingStr = localStorage.getItem('offline_sales') || '[]';
    const existing = JSON.parse(existingStr);
    setPendingCount(existing.length);
  };

  useEffect(() => {
    checkPending();
    const handleOnline = () => { setIsOnline(true); checkPending(); };
    const handleOffline = () => setIsOnline(false);
    
    // Polling as a fallback
    const interval = setInterval(checkPending, 5000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isOnline && pendingCount > 0 && hasFeature(tenant, 'OFFLINE')) {
      syncSales();
    }
  }, [isOnline, pendingCount, tenant]);

  const syncSales = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const existingStr = localStorage.getItem('offline_sales') || '[]';
      const existing = JSON.parse(existingStr);
      
      const failed = [];
      for (const record of existing) {
         try {
            await BackendAPI.processSale(record.reqContext, record.saleData);
         } catch (e) {
            console.error("Error syncing sale:", e);
            failed.push(record);
         }
      }
      localStorage.setItem('offline_sales', JSON.stringify(failed));
      setPendingCount(failed.length);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!hasFeature(tenant, 'OFFLINE')) return null;

  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-white text-[10px] sm:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-sm z-50">
        <WifiOff size={14} className="animate-pulse" /> 
        <span>Sin conexión. {pendingCount > 0 ? `(${pendingCount} ventas en espera)` : 'Modo Offline Activo.'}</span>
      </div>
    );
  }

  if (isOnline && isSyncing) {
    return (
      <div className="bg-blue-600 text-white text-[10px] sm:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-sm z-50">
        <CloudUpload size={14} className="animate-pulse" /> 
        <span>Sincronizando {pendingCount} ventas con el servidor...</span>
      </div>
    );
  }

  return null;
}

function MainLayout() {
  const { user, tenant, store, logout, hasPermission } = useAuth();
  const [currentView, setCurrentView] = useState<'pos' | 'dashboard' | 'inventory' | 'sales' | 'movements'>('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const auditEnabled = hasFeature(tenant, 'AUDIT');

  const navItemClick = (view: any) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0F1115] font-sans text-slate-900 dark:text-[#E2E8F0] overflow-hidden transition-colors relative">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-slate-100 dark:bg-[#111419] border-r border-slate-200 dark:border-[#2D3139] flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-[#2D3139] bg-white dark:bg-[#16191E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg border border-blue-600/10 dark:border-white/10 shrink-0">
              N
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">NEXUS <span className="font-light text-slate-500 dark:text-slate-400 text-sm italic">v2.0</span></h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase font-bold truncate max-w-[120px]">Plan {tenant?.plan}</p>
              </div>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 bg-white dark:bg-[#16191E] border-b border-slate-200 dark:border-[#2D3139] space-y-3 flex justify-between flex-col">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-800 border border-transparent dark:border-white/10 flex items-center justify-center shrink-0 shadow-sm">
              {user?.role === 'ADMIN' ? <ShieldCheck size={20} className="text-white"/> : <UserCog size={20} className="text-white"/>}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{user?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-black/20 p-2 border border-slate-200 dark:border-white/5 rounded-lg">
            <StoreIcon size={14} className="text-blue-600 dark:text-blue-500 shrink-0" />
            <span className="truncate">{store?.name}</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto flex flex-col gap-1">
          <div className="px-4 py-2 text-[10px] text-slate-400 dark:text-slate-600 uppercase font-bold tracking-[0.2em] mb-1">Operaciones</div>
          <NavItem icon={<ShoppingCart size={20} />} label="Terminal de Caja" active={currentView === 'pos'} onClick={() => navItemClick('pos')} />
          
          {hasPermission(['ADMIN', 'MANAGER']) && (
            <>
              <div className="px-4 py-2 text-[10px] text-slate-400 dark:text-slate-600 uppercase font-bold tracking-[0.2em] mt-4 mb-1">Management</div>
              <NavItem icon={<LayoutDashboard size={20} />} label="Panel de Control" active={currentView === 'dashboard'} onClick={() => navItemClick('dashboard')} />
              <NavItem icon={<PackageSearch size={20} />} label="Inventario y Stock" active={currentView === 'inventory'} onClick={() => navItemClick('inventory')} />
              
              {auditEnabled && (
                <>
                  <div className="px-4 py-2 text-[10px] text-slate-400 dark:text-slate-600 uppercase font-bold tracking-[0.2em] mt-4 mb-1">Auditoría</div>
                  <NavItem icon={<Receipt size={20} />} label="Registro de Ventas" active={currentView === 'sales'} onClick={() => navItemClick('sales')} />
                  <NavItem icon={<History size={20} />} label="Auditoría Movimientos" active={currentView === 'movements'} onClick={() => navItemClick('movements')} />
                </>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-[#2D3139] flex gap-2">
          <button onClick={logout} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg hover:bg-slate-200 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors font-medium">
            <LogOut size={20} />
            <span>Salir</span>
          </button>
          <ThemeToggle />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 transition-colors bg-white dark:bg-[#0F1115]">
        <SyncManager />
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-[#16191E] border-b border-slate-200 dark:border-[#2D3139]">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
              <Menu size={24} />
            </button>
            <span className="font-bold tracking-tight text-slate-900 dark:text-white">{store?.name}</span>
          </div>
          <ThemeToggle />
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          {currentView === 'pos' && <POSView />}
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'inventory' && <InventoryView />}
          {currentView === 'sales' && <SalesView />}
          {currentView === 'movements' && <MovementsView />}
        </div>
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
  const theme = useAppTheme();

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F1115] text-slate-900 dark:text-[#E2E8F0] font-sans flex items-center justify-center p-4 transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-white dark:bg-[#1A1D23] p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-200 dark:border-[#2D3139] transition-colors">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 text-white p-4 rounded-2xl mb-4 shadow-lg shrink-0 border border-blue-600/10 dark:border-white/10">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">NEXUS Auth 2.0</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mt-2 text-sm max-w-xs">
            Ingresa credenciales.
            <br/> <span className="font-mono text-xs text-slate-400 dark:text-slate-500">admin/1234 | caja1/0000</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-[#E2E8F0] rounded-xl outline-none focus:border-blue-500 transition-colors" placeholder="Usuario" autoFocus />
          <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" className="w-full text-center tracking-[1em] text-2xl p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl outline-none focus:border-blue-500 transition-colors" maxLength={4} />
          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors shadow-md shadow-blue-600/20">{loading ? 'Verificando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 7. PUNTO DE VENTA
// ============================================================================

function POSView() {
  const { reqContext, tenant } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [products, setProducts] = useState<ProductView[]>([]);
  const [cart, setCart] = useState<(ProductView & { quantity: number, subtotal: number })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmSaleInfo, setConfirmSaleInfo] = useState<any>(null);
  const [alertInfo, setAlertInfo] = useState<any>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  const executeCheckout = async () => {
    if (!confirmSaleInfo) return;
    setIsProcessing(true);
    try {
      if (!isOnline && hasFeature(tenant, 'OFFLINE')) {
        // Guardado local (Offline Mode)
        const offlineId = `OFF-${Date.now().toString().slice(-6)}`;
        const offlineSale = {
          saleId: offlineId,
          reqContext,
          saleData: {
            items: cart,
            paymentMethod: confirmSaleInfo.paymentMethod,
            amountTendered: confirmSaleInfo.amountTendered,
            isOfflineSync: true,
            offlineDate: new Date().toISOString()
          }
        };

        const existingStr = localStorage.getItem('offline_sales') || '[]';
        const existing = JSON.parse(existingStr);
        existing.push(offlineSale);
        localStorage.setItem('offline_sales', JSON.stringify(existing));

        setCart([]);
        setShowPaymentModal(false);
        setConfirmSaleInfo(null);
        
        // Pseudo Sale for Receipt rendering
        const pseudoSale: Sale = {
           id: offlineId,
           tenantId: reqContext.tenantId,
           storeId: reqContext.storeId,
           cashierId: reqContext.userId,
           datetime: offlineSale.saleData.offlineDate,
           total: cartTotal,
           paymentMethod: confirmSaleInfo.paymentMethod,
           amountTendered: confirmSaleInfo.amountTendered,
           changeAmount: confirmSaleInfo.amountTendered - cartTotal,
           items: cart as SaleItemWithName[]
        };

        setAlertInfo({ 
          title: 'Venta Registrada (Offline)', 
          message: `Estás sin conexión. La venta se ha guardado localmente y se sincronizará automáticamente cuando te conectes.`,
          saleData: pseudoSale
        });
      } else if (!isOnline) {
        throw new Error('No tienes conexión a internet y tu plan actual no soporta Modo Offline.');
      } else {
        const sale = await BackendAPI.processSale(reqContext, {
          items: cart,
          paymentMethod: confirmSaleInfo.paymentMethod,
          amountTendered: confirmSaleInfo.amountTendered
        });
        setCart([]);
        setShowPaymentModal(false);
        setConfirmSaleInfo(null);
        const updated = await BackendAPI.getStoreProducts(reqContext);
        setProducts(updated);
        setAlertInfo({ 
          title: 'Venta Procesada', 
          message: `La venta se procesó correctamente.`,
          saleData: sale 
        });
      }
    } catch (error: any) {
      setAlertInfo({ title: 'Error en la Venta', message: error.message });
      setConfirmSaleInfo(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = (paymentMethod: PaymentMethod, amountTendered: number) => {
    setConfirmSaleInfo({ paymentMethod, amountTendered });
  };

  return (
    <div className="flex h-full bg-[#0F1115] relative overflow-hidden">
      {isProcessing && (
        <div className="absolute inset-0 bg-[#0F1115]/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-[#1A1D23] border border-[#2D3139] p-6 rounded-2xl shadow-xl text-blue-400 font-bold">Procesando...</div>
        </div>
      )}

      {/* Cart Overlay for Mobile */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col p-4 lg:p-6 h-full overflow-hidden bg-slate-50 dark:bg-[#0F1115] transition-colors relative">
        {confirmSaleInfo && <ConfirmDialog title="Confirmar Venta" message={`¿Estás seguro de completar esta venta por ${formatCurrency(cartTotal)}?`} onConfirm={executeCheckout} onCancel={() => setConfirmSaleInfo(null)} />}
        {alertInfo && !alertInfo.saleData && <AlertDialog title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo(null)} />}
        {alertInfo?.saleData && <ReceiptModal sale={alertInfo.saleData} onClose={() => setAlertInfo(null)} storeName={reqContext.storeId} />}
        
        <div className="bg-white dark:bg-[#1A1D23] p-4 rounded-xl lg:rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3139] mb-4 lg:mb-6 flex items-center gap-4 transition-colors">
          <Barcode size={24} className="text-slate-500 hidden sm:block" />
          <Search size={24} className="text-slate-500 sm:hidden" />
          <input
            type="text" placeholder="Buscar producto o código..." className="flex-1 text-base lg:text-lg outline-none bg-transparent text-slate-900 dark:text-white"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 lg:pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 pb-32">
            {filteredProducts.map(product => (
              <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0}
                className={`text-left p-3 lg:p-4 rounded-xl flex flex-col border transition-all ${product.stock <= 0 ? 'bg-white dark:bg-[#1A1D23] opacity-50 border-slate-200 dark:border-[#2D3139]' : 'bg-white dark:bg-[#1A1D23] border-slate-200 dark:border-[#2D3139] hover:border-blue-500 dark:hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <div className="flex justify-between items-start mb-2 w-full">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider truncate mr-1">{product.category}</span>
                  {product.stock <= product.minStock && product.stock > 0 && <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">Stock: {product.stock}</span>}
                  {product.stock <= 0 && <span className="text-[10px] font-bold text-red-500 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 shrink-0">Agotado</span>}
                </div>
                <h3 className="font-bold text-xs lg:text-sm h-10 text-slate-900 dark:text-white line-clamp-2 w-full">{product.name}</h3>
                <div className="flex justify-between items-end mt-2 w-full">
                  <span className="text-slate-500 font-mono text-[10px] hidden sm:block">{product.barcode}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 text-sm lg:text-base ml-auto">{formatCurrency(product.price)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Floating Action Button for Mobile Cart */}
        {cart.length > 0 && (
          <div className="lg:hidden absolute bottom-6 inset-x-4">
            <button onClick={() => setIsCartOpen(true)} className="w-full bg-blue-600 text-white font-bold p-4 rounded-2xl shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} />
                <span>Ver Carrito ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
              </div>
              <span className="text-lg">{formatCurrency(cartTotal)}</span>
            </button>
          </div>
        )}
      </div>

      <div className={`fixed inset-y-0 right-0 z-40 w-full sm:w-96 lg:static bg-slate-100 dark:bg-[#111419] border-l border-slate-200 dark:border-[#2D3139] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="lg:hidden p-4 bg-white dark:bg-[#1A1D23] border-b border-slate-200 dark:border-[#2D3139] flex items-center justify-between">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">Carrito de Compra</h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {cart.map(item => (
            <div key={item.id} className="flex gap-3 bg-white dark:bg-[#1A1D23] p-3 border border-slate-200 dark:border-[#2D3139] rounded-xl text-slate-900 dark:text-white transition-colors">
              <div className="flex flex-col items-center bg-slate-100 dark:bg-black/20 rounded-lg p-1 border border-transparent dark:border-white/5">
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Plus size={14} /></button>
                <span className="font-bold text-sm my-1">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <h4 className="font-bold text-sm">{item.name}</h4>
                <span className="text-slate-500 text-xs">{formatCurrency(item.price)} c/u</span>
              </div>
              <div className="font-black flex items-center text-blue-600 dark:text-blue-400">{formatCurrency(item.subtotal)}</div>
            </div>
          ))}
          {!cart.length && <div className="h-full flex items-center justify-center text-slate-500">Carrito vacío</div>}
        </div>
        <div className="p-6 bg-white dark:bg-[#16191E] border-t border-slate-200 dark:border-[#2D3139] rounded-t-xl transition-colors">
          <div className="flex justify-between text-3xl font-mono tracking-tight mb-4 text-slate-900 dark:text-white">
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
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] rounded-2xl overflow-hidden w-full max-w-md transition-colors">
        <div className="bg-slate-50 dark:bg-[#16191E] p-6 text-slate-900 border-b border-slate-200 dark:border-[#2D3139] text-center transition-colors"><div className="text-5xl font-mono tracking-tight text-blue-600 dark:text-blue-500">{formatCurrency(total)}</div></div>
        <div className="p-6 space-y-6 text-slate-900 dark:text-[#E2E8F0] transition-colors">
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setMethod('CASH'); setTendered(total.toString()); }} className={`p-4 border rounded-xl font-bold transition-colors ${method==='CASH'?'border-blue-500 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400':'border-slate-200 dark:border-[#2D3139] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>EFECTIVO</button>
            <button onClick={() => { setMethod('CARD'); setTendered(total.toString()); }} className={`p-4 border rounded-xl font-bold transition-colors ${method==='CARD'?'border-blue-500 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400':'border-slate-200 dark:border-[#2D3139] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>TARJETA</button>
          </div>
          {method === 'CASH' && (
            <div>
              <input type="number" value={tendered} onChange={e => setTendered(e.target.value)} className="w-full text-right text-3xl font-mono p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] rounded-xl focus:border-blue-500 outline-none text-slate-900 dark:text-white transition-colors" onFocus={e => e.target.select()}/>
              <div className="flex justify-between mt-4"><span>Cambio</span><span className="font-mono text-2xl text-slate-900 dark:text-white">{formatCurrency(change>0?change:0)}</span></div>
            </div>
          )}
          <div className="flex gap-4">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-bold transition-colors">Cancelar</button>
            <button onClick={() => onComplete(method, tenderNum)} disabled={isInvalid} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:bg-slate-200 dark:disabled:bg-white/5 disabled:text-slate-400 dark:disabled:text-slate-600 transition-colors">Confirmar</button>
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
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductView | null>(null);
  const [alertInfo, setAlertInfo] = useState<any>(null);

  const loadData = () => BackendAPI.getStoreProducts(reqContext).then(setProducts);
  useEffect(() => { loadData(); }, []);

  const handleSave = async (data: any) => {
    try {
      await BackendAPI.saveProduct(reqContext, data);
      await loadData();
      setIsEditing(null);
      setAlertInfo({ title: 'Éxito', message: 'El producto se guardó correctamente.' });
    } catch (e:any) { 
      setAlertInfo({ title: 'Error', message: e.message });
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await BackendAPI.deleteProduct(reqContext, confirmDelete.id);
      await loadData();
      setConfirmDelete(null);
      setAlertInfo({ title: 'Producto Eliminado', message: 'El producto fue eliminado permanentemente.' });
    } catch (e:any) {
      setAlertInfo({ title: 'Error', message: e.message });
    }
  };

  const handleBulkSuccess = () => {
    setShowBulkImport(false);
    setAlertInfo({ title: 'Inventario Importado', message: 'Los productos se importaron exitosamente.' });
    loadData();
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search));

  return (
    <div className="p-4 lg:p-8 h-full flex flex-col bg-slate-50 dark:bg-[#0F1115] relative text-slate-900 dark:text-[#E2E8F0] transition-colors">
      {confirmDelete && <ConfirmDialog title="Eliminar Producto" message={`¿Estás seguro de que deseas eliminar permanentemente "${confirmDelete.name}"?`} onConfirm={executeDelete} onCancel={() => setConfirmDelete(null)} />}
      {alertInfo && <AlertDialog title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo(null)} />}
      {isEditing && <ProductFormModal product={isEditing} onClose={() => setIsEditing(null)} onSave={handleSave} />}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onSuccess={handleBulkSuccess} />}
      
      <div className="flex flex-col md:flex-row md:justify-between tracking-tight gap-4 mb-6 lg:mb-8">
        <div><h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Inventario de Catálogo</h2></div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulkImport(true)} className="flex-1 md:flex-none justify-center bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-900 dark:text-white text-sm px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors"><Upload size={18}/> Importar</button>
          <button onClick={() => setIsEditing({category: 'Abarrotes', stock: 0, minStock: 5})} className="flex-1 md:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors"><Plus size={18}/> Nuevo</button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1A1D23] flex-1 rounded-xl shadow-sm border border-slate-200 dark:border-[#2D3139] overflow-hidden flex flex-col transition-colors">
        <div className="p-3 lg:p-4 border-b border-slate-200 dark:border-[#2D3139] transition-colors">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-lg outline-none focus:border-blue-500 transition-colors"/>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
            <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-[#2D3139] text-slate-500 dark:text-slate-400 sticky top-0 uppercase font-bold text-[10px] tracking-widest transition-colors z-10">
              <tr><th className="px-6 py-4">SKU / Código</th><th className="px-6 py-4">Producto</th><th className="px-6 py-4">Precio</th><th className="px-6 py-4 text-center">Stock</th><th className="px-6 py-4 text-center">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2D3139] transition-colors">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-700 dark:text-slate-300">
                  <td className="px-6 py-4 font-mono text-slate-500 text-xs">{p.barcode}</td>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{p.name} <span className="text-[10px] text-slate-500 block">{p.category}</span></td>
                  <td className="px-6 py-4 font-mono text-blue-600 dark:text-blue-400">{formatCurrency(p.price)}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      {p.stock <= 0 ? (
                        <span className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20">
                          <AlertCircle size={12} strokeWidth={3} /> {p.stock} (Agotado)
                        </span>
                      ) : p.stock <= p.minStock ? (
                        <span className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-200 dark:border-amber-500/20">
                          <AlertCircle size={12} strokeWidth={3} /> {p.stock} (Bajo)
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-[10px] font-bold border bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10">
                          {p.stock}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-400">
                    <button onClick={() => setIsEditing(p)} className="p-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Edit size={16}/></button>
                    <button onClick={() => setConfirmDelete(p)} className="p-2 hover:text-red-600 dark:hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                  </td>
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
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] rounded-2xl w-full max-w-xl p-6 text-slate-900 dark:text-[#E2E8F0] transition-colors">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">{product.id ? 'Editar' : 'Nuevo'} Producto</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <input required placeholder="Código (ej. 12345)" value={data.barcode||''} onChange={e=>setData({...data, barcode: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required placeholder="Categoría (ej. General)" value={data.category||''} onChange={e=>setData({...data, category: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required placeholder="Nombre ('producto')" value={data.name||''} onChange={e=>setData({...data, name: e.target.value})} className="col-span-2 p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" step="0.01" placeholder="Costo proveedor" value={data.cost||''} onChange={e=>setData({...data, cost: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" step="0.01" placeholder="Venta publico" value={data.price||''} onChange={e=>setData({...data, price: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" placeholder="Items (Stock)" value={data.stock||0} onChange={e=>setData({...data, stock: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" placeholder="Min Stock" value={data.minStock||0} onChange={e=>setData({...data, minStock: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-bold transition-colors">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-white/5 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl font-bold transition-colors">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function BulkImportModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { reqContext } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<any[] | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert array of arrays or json
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (!data || data.length === 0) {
          throw new Error("El archivo está vacío o no se pudo leer correctamente.");
        }

        const formattedProducts = data.map((row: any, index: number) => {
          // Attempt to match the headers from the image, but be forgiving
          const name = row['producto'] || row['Producto'] || row['Name'] || '';
          const cost = Number(row['Costo proveedor'] || row['Costo'] || row['cost'] || 0);
          const price = Number(row['Venta publico'] || row['Precio'] || row['price'] || 0);
          const stock = Number(row['Items'] || row['Stock'] || row['stock'] || 0);

          if (!name) throw new Error(`Fila ${index + 1}: El nombre del producto es obligatorio. Asegúrate de tener una columna llamada "producto"`);

          return {
            name,
            cost,
            price,
            stock,
            minStock: 5, // Default
            category: 'General', // Default
            barcode: Math.floor(100000000 + Math.random() * 900000000).toString(), // Auto-generate 9 digit barcode
          };
        });

        setConfirmData(formattedProducts);
      } catch (err: any) {
        setError(err.message || "Error al procesar el archivo Excel.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async () => {
    if (!confirmData) return;
    try {
      setLoading(true);
      await BackendAPI.saveProductsBulk(reqContext, confirmData);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al procesar el archivo Excel.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {confirmData && (
        <ConfirmDialog 
          title="Confirmar Importación" 
          message={`¿Estás seguro de importar ${confirmData.length} productos a este catálogo?`} 
          onConfirm={processImport} 
          onCancel={() => setConfirmData(null)} 
        />
      )}
      <div className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] rounded-2xl w-full max-w-md p-6 text-slate-900 dark:text-[#E2E8F0] transition-colors">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Importar Inventario</h2>
        <p className="text-sm text-slate-500 mb-6">Sube un archivo .xlsx o .csv con las columnas: <br/><strong className="text-slate-900 dark:text-white">producto, Costo proveedor, Venta publico, Items</strong>.</p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="mb-6">
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${loading ? 'opacity-50 cursor-not-allowed border-slate-300 dark:border-[#2D3139]' : 'border-blue-300 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/5 bg-slate-50 dark:bg-[#0F1115]'}`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-3 text-blue-500" />
              <p className="mb-2 text-sm text-slate-500 dark:text-slate-400 font-bold">{loading ? 'Procesando...' : 'Haz clic para seleccionar archivo'}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">XLSX, XLS, CSV</p>
            </div>
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} disabled={loading} />
          </label>
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={onClose} disabled={loading} className="w-full py-3 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-bold transition-colors">Cerrar</button>
        </div>
      </div>
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
    <div className="p-4 lg:p-8 h-full overflow-y-auto bg-slate-50 dark:bg-[#0F1115] text-slate-900 dark:text-[#E2E8F0] flex flex-col gap-4 lg:gap-6 transition-colors">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard Múlti-tenant</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard title="Ingresos (Store)" value={formatCurrency(totalRevenue)} icon={<Banknote size={20}/>} color="bg-blue-500" />
        <StatCard title="Ganancia Neta" value={formatCurrency(totalProfit)} icon={<TrendingUp size={20}/>} color="bg-emerald-500" />
        <StatCard title="Inventario Value" value={formatCurrency(iv)} icon={<PackageSearch size={20}/>} color="bg-purple-500" />
        <StatCard title="Ventas Totales" value={sales.length} icon={<Receipt size={20}/>} color="bg-amber-500" />
      </div>

      <div className="mt-2 flex items-center justify-center p-4 border border-dashed border-slate-300 dark:border-[#2D3139] rounded-xl bg-slate-100 dark:bg-white/5 transition-colors">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Resumen General Actualizado Automáticamente</span>
      </div>
    </div>
  );
}

function SalesView() {
  const { reqContext } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);

  useEffect(() => { BackendAPI.getSales({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(setSales); }, [reqContext]);

  return (
    <div className="p-4 lg:p-8 h-full flex flex-col bg-slate-50 dark:bg-[#0F1115] text-slate-900 dark:text-[#E2E8F0] gap-4 lg:gap-6 transition-colors">
      {selectedReceipt && <ReceiptModal sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} storeName={reqContext.storeId} />}
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Registro de Ventas</h2>
      <div className="bg-white dark:bg-[#1A1D23] flex-1 rounded-xl shadow-sm border border-slate-200 dark:border-[#2D3139] overflow-auto transition-colors">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
          <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-[#2D3139] uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400 transition-colors">
            <tr><th className="px-6 py-4">ID Transacción</th><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Método</th><th className="px-6 py-4">Total</th><th className="px-6 py-4 text-center">Items</th><th className="px-6 py-4 text-center">Recibo</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-[#2D3139] transition-colors">
            {sales.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-700 dark:text-slate-300">
                <td className="px-6 py-4 font-mono text-slate-500 text-xs">{s.id}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{new Date(s.datetime).toLocaleString()}</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded border border-slate-200 dark:border-white/10 uppercase transition-colors">{s.paymentMethod}</span></td>
                <td className="px-6 py-4 font-mono text-blue-600 dark:text-blue-400 font-bold">{formatCurrency(s.total)}</td>
                <td className="px-6 py-4 text-center text-slate-500 dark:text-slate-400">{s.itemsCount}</td>
                <td className="px-6 py-4 text-center text-slate-400">
                  <button onClick={() => setSelectedReceipt(s)} className="p-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Printer size={16}/></button>
                </td>
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
    <div className="p-4 lg:p-8 h-full flex flex-col bg-slate-50 dark:bg-[#0F1115] text-slate-900 dark:text-[#E2E8F0] gap-4 lg:gap-6 transition-colors">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">Auditoría <span className="text-xs font-normal text-slate-500 hidden sm:inline">• Store Movements</span></h2>
      <div className="bg-white dark:bg-[#111419] flex-1 rounded-xl shadow-sm border border-slate-200 dark:border-[#2D3139] p-4 flex flex-col gap-4 overflow-y-auto transition-colors">
        {moves.map(m => (
          <div key={m.id} className="flex gap-4 group">
            <div className={`w-1 rounded-full ${m.quantity > 0 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
            <div className="flex-1 border-b border-slate-100 dark:border-[#1A1D23] pb-3">
              <div className="text-xs font-bold uppercase text-slate-500 tracking-tight">{m.type} • {m.productName}</div>
              <div className="text-sm text-slate-700 dark:text-slate-300 transition-colors">
                Quantity adjusted by <span className={m.quantity > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span> units
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-600 font-medium mt-1">By user: {m.userName} • {new Date(m.date).toLocaleString()} • {m.reason}</div>
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

function ReceiptModal({ sale, storeName, onClose }: any) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-blur-none">
      <div className="flex gap-4 mb-4 no-print flex-col sm:flex-row w-full sm:w-auto">
        <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full flex items-center justify-center gap-2 shadow-lg transition-colors"><Printer size={18}/> Imprimir / PDF</button>
        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-full flex items-center justify-center gap-2 transition-colors">Cerrar</button>
      </div>
      
      <div className="relative bg-white text-black w-full max-w-sm flex-col overflow-hidden shadow-2xl print:shadow-none print:w-full print:max-w-full">
         <div className="ticket-top"></div>
         <div className="p-8 pb-12 flex flex-col items-center relative z-10 bg-white">
             {/* Header */}
             <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mb-4 shadow-sm"><span className="font-bold text-xl">N</span></div>
             <h2 className="font-black text-2xl tracking-tighter uppercase mb-1">{storeName || 'NEXUS TIE'}</h2>
             <p className="text-gray-500 text-xs font-mono mb-6 uppercase tracking-widest">Recibo Oficial</p>
             
             {/* Dotted separator */}
             <div className="w-full border-t-2 border-dashed border-gray-300 my-4 relative">
                <div className="absolute -left-11 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0F1115] print:bg-white rounded-full"></div>
                <div className="absolute -right-11 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0F1115] print:bg-white rounded-full"></div>
             </div>

             {/* Metadata */}
             <div className="w-full space-y-3 mb-6 mt-2">
                <div className="flex justify-between text-xs font-mono text-gray-400">
                  <span>FECHA</span>
                  <span className="text-gray-800">{new Date(sale.datetime).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-mono text-gray-400">
                  <span>TICKET #</span>
                  <span className="text-black font-bold">{sale.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-xs font-mono text-gray-400">
                  <span>MÉTODO</span>
                  <span className="text-black font-bold uppercase tracking-wider">{sale.paymentMethod}</span>
                </div>
             </div>

             {/* Items */}
             <div className="w-full">
                <h3 className="font-bold text-xs uppercase tracking-widest border-b-2 border-black pb-2 mb-3 text-gray-400">Artículos</h3>
                {sale.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 font-medium leading-snug">
                    <div className="flex flex-col max-w-[70%]">
                      <span className="text-black">{item.name}</span>
                      <span className="text-xs text-gray-500 font-mono mt-0.5">{item.quantity} x {formatCurrency(item.price)}</span>
                    </div>
                    <span className="text-black font-bold">{formatCurrency(item.quantity * item.price)}</span>
                  </div>
                ))}
             </div>

             {/* Total */}
             <div className="w-full border-t-2 border-black mt-6 pt-4 flex justify-between items-end">
                <span className="font-bold text-gray-400 text-sm tracking-widest">TOTAL</span>
                <span className="font-black text-3xl tracking-tighter text-black">{formatCurrency(sale.total)}</span>
             </div>

             {/* Footer Barcode */}
             <div className="mt-10 flex flex-col items-center">
                <QrCode size={64} strokeWidth={1} className="mb-3 text-black"/>
                <p className="text-[9px] text-gray-400 font-mono tracking-widest text-center uppercase leading-relaxed">
                  Gracias por tu compra<br/>
                  <span className="text-black font-bold mt-1 block">{sale.id}</span>
                </p>
             </div>
         </div>
         <div className="ticket-bottom"></div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string, message: string, onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] p-6 rounded-2xl w-full max-w-sm text-slate-900 dark:text-[#E2E8F0] shadow-xl transition-colors">
        <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-500 mb-6">{message}</p>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-bold transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function AlertDialog({ title, message, onClose }: { title: string, message: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] p-6 rounded-2xl w-full max-w-sm text-slate-900 dark:text-[#E2E8F0] shadow-xl text-center transition-colors">
        <div className="flex justify-center mb-4 text-emerald-500"><CheckCircle2 size={48} /></div>
        <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-500 mb-6">{message}</p>
        <button onClick={onClose} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">Aceptar</button>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${active ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20 shadow-none' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 border border-transparent'}`}>
      {icon} {label}
    </button>
  );
}

function StatCard({ icon, title, value, color }: any) {
  return (
    <div className="bg-white dark:bg-[#1A1D23] p-5 border border-slate-200 dark:border-[#2D3139] rounded-xl flex flex-col justify-between transition-colors">
      <div className={`text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 flex items-center justify-between`}>
        {title}
        <div className={`p-1.5 rounded-lg bg-slate-100 dark:bg-black/20 text-blue-600 dark:text-blue-400`}>{icon}</div>
      </div>
      <h4 className="text-2xl font-mono text-slate-900 dark:text-white tracking-tight">{value}</h4>
    </div>
  );
}

function ThemeToggle() {
  const theme = useAppTheme();
  return (
    <button onClick={theme.toggleTheme} className="px-4 py-3 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors">
      {theme.isDark ? <Sun size={20}/> : <Moon size={20}/>}
    </button>
  );
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
