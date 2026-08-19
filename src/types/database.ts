// TypeScript types for the RetailTex database

// ============ System & Company ============

export interface Company {
  frm_code: number;
  frm_name: string;
  add1?: string;
  add2?: string;
  city?: string;
  dist?: string;
  state?: string;
  st_code?: string;
  pin?: string;
  ph_no?: string;
  cell_no?: string;
  email?: string;
  web?: string;
  gstin?: string;
  tin_no?: string;
  cst_no?: string;
  pan_no?: string;
  reg_no?: string;
  bank_name?: string;
  acc_no?: string;
  ifsc?: string;
  branch?: string;
  bcode?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppSetting {
  id: number;
  frm_code: number;
  barcode?: string;
  bill_type?: string;
  round_off: string;
  zari_wt: number;
  bank_ldg_no: number;
  cash_ldg_no: number;
  sale_tax_ldg_no: number;
  pur_tax_ldg_no: number;
  pur_slip_char: string;
  sal_slip_char: string;
  est_slip_char: string;
  wls_slip_char: string;
  itc_slip_char: string;
  del_slip_char: string;
  json_ver?: string;
}

export interface Admin {
  am_ref_no: number;
  user_name: string;
  user_password: string;
  user_type: "Administrator" | "User";
  user_status: "Active" | "Inactive";
  created_at?: string;
}

export interface UserPermission {
  id: number;
  user_id: number;
  menu_id: number;
  menu_name: string;
  add_right: boolean;
  edit_right: boolean;
  delete_right: boolean;
  view_right: boolean;
  print_right: boolean;
}

export interface Session {
  sn_id: number;
  sn_rec_no?: number;
  user_id: number;
  sn_from_year: string;
  sn_to_year: string;
  header?: string;
  active: string;
  frm_code: number;
}

// ============ Financial Accounting ============

export interface GroupMaster {
  grp_id: number;
  grp_name: string;
  grp_type: "Primary" | "SubGroup";
  base_grp_id: number;
}

export interface SubGroup {
  sub_grp_id: number;
  grp_id: number;
  sub_grp_name: string;
}

export interface Ledger {
  ledg_code: number;
  grp_id: number;
  sub_grp_name?: string;
  ledg_name: string;
  print_name?: string;
  street?: string;
  add1?: string;
  add2?: string;
  city?: string;
  dist?: string;
  state?: string;
  state_code?: string;
  pin_code?: string;
  gstin?: string;
  reg_no: number;
  pan_no?: string;
  ph_no?: string;
  cell_no?: string;
  email?: string;
  acc_type: string;
  op_bal: number;
  op_bal_type: string;
  bal_amt: number;
  bal_type: string;
  frm_code: number;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  grp_name?: string;
}

// ============ Products & Inventory ============

export interface ProductGroup {
  ref_no: number;
  grp_code: string;
  grp_name: string;
  hsn_code?: string;
  gst_perc: number;
  status: string;
  frm_code: number;
}

export interface Product {
  ref_no: number;
  grp_code: number;
  prd_code: string;
  prd_name: string;
  bar_code?: string;
  units: string;
  min_stock: number;
  max_stock: number;
  re_order: number;
  rate: number;
  wages: number;
  weight: number;
  dis_perc: number;
  sales_price: number;
  tag_price: number;
  margin_sale: number;
  margin_tag: number;
  is_stock: string;
  status: string;
  frm_code: number;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  grp_name?: string;
  hsn_code?: string;
}

export interface ColourInfo {
  ref_no: number;
  colour_code: string;
  colour_name: string;
  frm_code: number;
}

export interface UnitsMaster {
  id: number;
  unit_name: string;
  frm_code?: number;
}

// ============ Tax ============

export interface TaxSetup {
  tax_id: number;
  tax_reg_code: number;
  tax_head_code: number;
  tax_cgst_code: number;
  cgst_perc: number;
  tax_sgst_code: number;
  sgst_perc: number;
  tax_igst_code: number;
  igst_perc: number;
  frm_code: number;
}

export interface ProdTaxSetup {
  tax_id: number;
  prd_code: number;
  cgst_reg_code: number;
  sl_cgst_perc: number;
  sgst_reg_code: number;
  sl_sgst_perc: number;
  igst_reg_code: number;
  sl_igst_perc: number;
  pu_cgst_perc: number;
  pu_sgst_perc: number;
  pu_igst_perc: number;
  hsn_code?: string;
  frm_code: number;
}

// ============ Purchase ============

export interface PurMast {
  pm_ref_no: number;
  pm_rec_no: number;
  pm_reg_code: number;
  pm_tax_model?: string;
  pm_cr_code: number;
  pm_dr_code: number;
  pm_bill_char?: string;
  pm_bill_ref_no?: string;
  pm_bill_date: string;
  pm_entry_date?: string;
  pm_dr_narr?: string;
  pm_cr_narr?: string;
  pm_tot_qty: number;
  pm_grd_tot: number;
  pm_bf_gst_amt: number;
  pm_igst_amt: number;
  pm_cgst_amt: number;
  pm_sgst_amt: number;
  pm_rnd_off: number;
  pm_net_total: number;
  pm_frm_code: number;
  // Joined
  supplier_name?: string;
}

export interface PurChild {
  pc_ref_no: number;
  pm_ref_no: number;
  pc_bill_date?: string;
  pc_prcode: number;
  pc_pgrcode: number;
  pc_qty: number;
  pc_pur_rate: number;
  pc_sale_rate: number;
  pc_tag_rate: number;
  pc_dis_perc: number;
  pc_disc_amt: number;
  pc_total: number;
  pc_net_tot: number;
  pc_igst_perc: number;
  pc_igst_amt: number;
  pc_cgst_perc: number;
  pc_cgst_amt: number;
  pc_sgst_perc: number;
  pc_sgst_amt: number;
  cr_code?: number;
  dr_code?: number;
  frm_code: number;
  // Joined
  prd_name?: string;
  grp_name?: string;
}

// ============ Sales ============

export interface RetailSaleMast {
  rm_ref_no: number;
  rm_rec_no: number;
  em_ref_no?: number;
  em_bill_no?: string;
  reg_code: number;
  rm_tax_model?: string;
  cust_name?: string;
  city?: string;
  state?: string;
  state_code?: string;
  gstin?: string;
  rm_ph_no?: string;
  rm_cr_code: number;
  rm_mode_one: string;
  rm_dr_code_one: number;
  rm_recd_one_amt: number;
  rm_mode_two?: string;
  rm_dr_code_two?: number;
  rm_recd_two_amt: number;
  rm_bill_char?: string;
  rm_bill_ref_no?: string;
  rm_bill_date: string;
  rm_tot_qty: number;
  rm_grd_tot: number;
  rm_bf_gst_amt: number;
  rm_igst_amt: number;
  rm_cgst_amt: number;
  rm_sgst_amt: number;
  rm_rnd_off: number;
  rm_net_total: number;
  rm_frm_code: number;
}

export interface RetailSaleChild {
  dc_ref_no: number;
  rm_ref_no: number;
  dc_bar_no?: string;
  dc_prcode: number;
  dc_pgrcode: number;
  dc_qty: number;
  dc_rate: number;
  dc_net_tot: number;
  dc_igst_perc: number;
  dc_igst_amnt: number;
  dc_cgst_perc: number;
  dc_cgst_amnt: number;
  dc_sgst_perc: number;
  dc_sgst_amnt: number;
  bar_ref_id?: number;
  cr_code?: number;
  pc_ref_no?: number;
  emp_no?: number;
  frm_code: number;
  // Joined
  prd_name?: string;
}

// ============ Barcode ============

export interface BarTemp {
  bar_ref_id: number;
  bar_no: string;
  pc_ref_no?: number;
  prcode: number;
  grp_code: number;
  pc_pur_rate: number;
  pc_sale_rate: number;
  qty: number;
  cr_code?: number;
  sold_status: "A" | "S";
  bar_date: string;
  frm_code: number;
  // Joined
  prd_name?: string;
  grp_name?: string;
}

// ============ Auth Context ============

export interface AuthUser {
  am_ref_no: number;
  user_name: string;
  user_type: "Administrator" | "User";
}

export interface AppContext {
  user: AuthUser | null;
  company: Company | null;
  session: Session | null;
  permissions: UserPermission[];
}
