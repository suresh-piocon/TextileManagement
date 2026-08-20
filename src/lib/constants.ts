// Application constants

export const APP_NAME = "RetailTex";
export const APP_VERSION = "1.0.0";

// Account Group IDs (matching seed data)
export const ACCOUNT_GROUPS = {
  CAPITAL_ACCOUNT: 1,
  LOANS_LIABILITY: 2,
  CURRENT_LIABILITIES: 3,
  FIXED_ASSETS: 4,
  INVESTMENTS: 5,
  CURRENT_ASSETS: 6,
  BRANCH_DIVISIONS: 7,
  MISC_EXPENSES: 8,
  SUSPENSE: 9,
  SALES_ACCOUNTS: 10,
  PURCHASE_ACCOUNTS: 11,
  DIRECT_INCOMES: 12,
  DIRECT_EXPENSES: 13,
  INDIRECT_INCOMES: 14,
  INDIRECT_EXPENSES: 15,
  SUNDRY_DEBTORS: 59,
  BANK_ACCOUNTS: 60,
  CASH_IN_HAND: 61,
  DEPOSITS: 62,
  STOCK_IN_HAND: 63,
  DUTIES_TAXES: 64,
  SUNDRY_CREDITORS: 65,
  PROVISIONS: 66,
  SECURED_LOANS: 67,
  UNSECURED_LOANS: 68,
  RESERVES_SURPLUS: 69,
  SALES_ACCOUNT: 74,
  PURCHASE_ACCOUNT: 75,
} as const;

// Tax Registration Types
export const TAX_REG = {
  INTRA_STATE: 50,
  INTER_STATE: 51,
} as const;

// Barcode Status
export const BARCODE_STATUS = {
  AVAILABLE: "A",
  SOLD: "S",
} as const;

// User Types
export const USER_TYPES = {
  ADMINISTRATOR: "Administrator",
  USER: "User",
} as const;

// Payment Modes
export const PAYMENT_MODES = ["Cash", "Card", "UPI", "Credit", "Bank Transfer"] as const;

// Indian States with GST Code
export const INDIAN_STATES = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (Old)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
] as const;

// Menu Items for Sidebar Navigation
export type MenuItem = {
  id: string;
  label: string;
  icon: string;
  href?: string;
  children?: MenuItem[];
};

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    href: "/dashboard",
  },
  {
    id: "master",
    label: "Masters",
    icon: "Database",
    children: [
      { id: "ledger-group", label: "Ledger Group", icon: "FolderTree", href: "/master/ledger-group" },
      { id: "ledger", label: "Ledger", icon: "BookOpen", href: "/master/ledger" },
      { id: "product-group", label: "Product Group", icon: "Layers", href: "/master/product-group" },
      { id: "product", label: "Product", icon: "Package", href: "/master/product" },
      { id: "colour", label: "Colour", icon: "Palette", href: "/master/colour" },
      { id: "warp-type", label: "Warp Type", icon: "Rows3", href: "/master/warp-type" },
      { id: "weft-type", label: "Weft Type", icon: "Columns3", href: "/master/weft-type" },
      { id: "units", label: "Units", icon: "Ruler", href: "/master/units" },
      { id: "tax-setup", label: "Tax Setup", icon: "Receipt", href: "/master/tax-setup" },
      { id: "barcode-setting", label: "Barcode Setting", icon: "Barcode", href: "/master/barcode-setting" },
    ],
  },
  {
    id: "transaction",
    label: "Transactions",
    icon: "ArrowLeftRight",
    children: [
      { id: "purchase", label: "Purchase", icon: "ShoppingCart", href: "/transaction/purchase" },
      { id: "purchase-return", label: "Purchase Return", icon: "RotateCcw", href: "/transaction/purchase-return" },
      { id: "estimate", label: "Estimate", icon: "FileText", href: "/transaction/estimate" },
      { id: "retail-sale", label: "Retail Sale (POS)", icon: "Store", href: "/transaction/retail-sale" },
      { id: "retail-return", label: "Retail Return", icon: "PackageX", href: "/transaction/retail-return" },
      { id: "delivery-challan", label: "Delivery Challan", icon: "Truck", href: "/transaction/delivery-challan" },
      { id: "wholesale", label: "Wholesale Invoice", icon: "Building2", href: "/transaction/wholesale" },
      { id: "wholesale-return", label: "Wholesale Return", icon: "Undo2", href: "/transaction/wholesale-return" },
      { id: "inward", label: "Inward", icon: "PackagePlus", href: "/transaction/inward" },
    ],
  },
  {
    id: "voucher",
    label: "Vouchers",
    icon: "CreditCard",
    children: [
      { id: "receipt", label: "Receipt", icon: "Download", href: "/voucher/receipt" },
      { id: "payment", label: "Payment", icon: "Upload", href: "/voucher/payment" },
      { id: "journal", label: "Journal", icon: "BookOpen", href: "/voucher/journal" },
      { id: "contra", label: "Contra", icon: "ArrowUpDown", href: "/voucher/contra" },
      { id: "credit-note", label: "Credit Note", icon: "FileDown", href: "/voucher/credit-note" },
      { id: "debit-note", label: "Debit Note", icon: "FileUp", href: "/voucher/debit-note" },
    ],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    icon: "Factory",
    children: [
      { id: "lot", label: "Lot Creation", icon: "Boxes", href: "/manufacturing/lot" },
      { id: "twisting", label: "Twisting", icon: "Cable", href: "/manufacturing/twisting" },
      { id: "dyeing", label: "Dyeing", icon: "Pipette", href: "/manufacturing/dyeing" },
      { id: "warp-design", label: "Warp Design", icon: "Grid3x3", href: "/manufacturing/warp-design" },
      { id: "loom", label: "Loom", icon: "Cog", href: "/manufacturing/loom" },
      { id: "weaving", label: "Weaving", icon: "Workflow", href: "/manufacturing/weaving" },
      { id: "costing", label: "Product Costing", icon: "Calculator", href: "/manufacturing/costing" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: "Warehouse",
    children: [
      { id: "barcode", label: "Barcode", icon: "Barcode", href: "/inventory/barcode" },
      { id: "stock-value", label: "Stock Value", icon: "TrendingUp", href: "/inventory/stock-value" },
      { id: "stock-journal", label: "Stock Journal", icon: "ClipboardList", href: "/inventory/stock-journal" },
      { id: "physical-stock", label: "Physical Stock", icon: "ScanBarcode", href: "/inventory/physical-stock" },
      { id: "opening-stock", label: "Opening Stock", icon: "FolderOpen", href: "/inventory/opening-stock" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "BarChart3",
    children: [
      { id: "purchase-register", label: "Purchase Register", icon: "FileSpreadsheet", href: "/reports/purchase-register" },
      { id: "sales-register", label: "Sales Register", icon: "FileSpreadsheet", href: "/reports/sales-register" },
      { id: "stock-report", label: "Stock Report", icon: "ClipboardList", href: "/reports/stock-report" },
      { id: "gst-report", label: "GST Report", icon: "IndianRupee", href: "/reports/gst-report" },
      { id: "trial-balance", label: "Trial Balance", icon: "Scale", href: "/reports/trial-balance" },
      { id: "balance-sheet", label: "Balance Sheet", icon: "Sheet", href: "/reports/balance-sheet" },
      { id: "profit-loss", label: "Profit & Loss", icon: "TrendingUp", href: "/reports/profit-loss" },
      { id: "ledger-report", label: "Ledger Report", icon: "BookOpen", href: "/reports/ledger-report" },
      { id: "outstanding", label: "Outstanding", icon: "Clock", href: "/reports/outstanding" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "Settings",
    children: [
      { id: "company", label: "Company", icon: "Building", href: "/company" },
      { id: "app-settings", label: "App Settings", icon: "SlidersHorizontal", href: "/settings/app-settings" },
      { id: "users", label: "Users", icon: "Users", href: "/settings/users" },
      { id: "permissions", label: "Permissions", icon: "Shield", href: "/settings/permissions" },
      { id: "session", label: "Financial Year", icon: "CalendarRange", href: "/settings/session" },
    ],
  },
];
