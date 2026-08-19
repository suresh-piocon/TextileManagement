-- 001_system_company.sql

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS company (
    frm_code SERIAL PRIMARY KEY,
    frm_name VARCHAR(150) NOT NULL,
    add1 VARCHAR(200),
    add2 VARCHAR(200),
    city VARCHAR(50),
    dist VARCHAR(50),
    state VARCHAR(50),
    st_code VARCHAR(10),
    pin VARCHAR(10),
    ph_no VARCHAR(50),
    cell_no VARCHAR(50),
    email VARCHAR(100),
    web VARCHAR(100),
    gstin VARCHAR(50),
    tin_no VARCHAR(50),
    cst_no VARCHAR(50),
    pan_no VARCHAR(50),
    reg_no VARCHAR(50),
    bank_name VARCHAR(100),
    acc_no VARCHAR(100),
    ifsc VARCHAR(50),
    branch VARCHAR(100),
    logo BYTEA,
    c_logo BYTEA,
    bcode VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE company ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_company_modtime BEFORE UPDATE ON company FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS app_setting (
    id SERIAL PRIMARY KEY,
    frm_code INTEGER REFERENCES company(frm_code) ON DELETE CASCADE,
    barcode VARCHAR(50),
    bill_type VARCHAR(50),
    round_off VARCHAR(50) DEFAULT 'Auto',
    zari_wt NUMERIC(18,3) DEFAULT 0,
    bank_ldg_no INTEGER DEFAULT 0,
    cash_ldg_no INTEGER DEFAULT 0,
    sale_tax_ldg_no INTEGER DEFAULT 0,
    pur_tax_ldg_no INTEGER DEFAULT 0,
    pur_slip_char VARCHAR(10) DEFAULT 'P',
    sal_slip_char VARCHAR(10) DEFAULT 'S',
    est_slip_char VARCHAR(10) DEFAULT 'E',
    wls_slip_char VARCHAR(10) DEFAULT 'W',
    itc_slip_char VARCHAR(10) DEFAULT 'I',
    del_slip_char VARCHAR(10) DEFAULT 'D',
    json_ver VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_setting ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_app_setting_modtime BEFORE UPDATE ON app_setting FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS admin (
    am_ref_no SERIAL PRIMARY KEY,
    user_name VARCHAR(50) NOT NULL UNIQUE,
    user_password VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) DEFAULT 'User' CHECK (user_type IN ('Administrator', 'User')),
    user_status VARCHAR(20) DEFAULT 'Active' CHECK (user_status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admin ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_admin_modtime BEFORE UPDATE ON admin FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

INSERT INTO admin (user_name, user_password, user_type, user_status) 
VALUES ('admin', 'admin123', 'Administrator', 'Active')
ON CONFLICT (user_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_permission (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin(am_ref_no) ON DELETE CASCADE,
    menu_id INTEGER NOT NULL,
    menu_name VARCHAR(100),
    add_right BOOLEAN DEFAULT false,
    edit_right BOOLEAN DEFAULT false,
    delete_right BOOLEAN DEFAULT false,
    view_right BOOLEAN DEFAULT true,
    print_right BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_permission ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS user_log_info (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin(am_ref_no),
    log_date TIMESTAMPTZ DEFAULT NOW(),
    log_in_time VARCHAR(50),
    log_out_time VARCHAR(50),
    machine_name VARCHAR(100),
    frm_no INTEGER REFERENCES company(frm_code)
);
ALTER TABLE user_log_info ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS session (
    sn_id SERIAL PRIMARY KEY,
    sn_rec_no INTEGER,
    user_id INTEGER REFERENCES admin(am_ref_no),
    sn_from_year TIMESTAMPTZ NOT NULL,
    sn_to_year TIMESTAMPTZ NOT NULL,
    header VARCHAR(200),
    active VARCHAR(10) DEFAULT 'Yes',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE session ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS amount_setup (
    ref_no SERIAL PRIMARY KEY,
    set_amount NUMERIC(18,2),
    frm_code INTEGER REFERENCES company(frm_code)
);
ALTER TABLE amount_setup ENABLE ROW LEVEL SECURITY;
-- 002_accounting.sql

CREATE TABLE IF NOT EXISTS group_master (
    grp_id SERIAL PRIMARY KEY,
    grp_name VARCHAR(100) NOT NULL,
    grp_type VARCHAR(50) DEFAULT 'Primary' CHECK (grp_type IN ('Primary', 'SubGroup')),
    base_grp_id INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE group_master ENABLE ROW LEVEL SECURITY;

INSERT INTO group_master (grp_id, grp_name, grp_type, base_grp_id) VALUES
(1, 'Capital Account', 'Primary', 0),
(2, 'Loans (Liability)', 'Primary', 0),
(3, 'Current Liabilities', 'Primary', 0),
(4, 'Fixed Assets', 'Primary', 0),
(5, 'Investments', 'Primary', 0),
(6, 'Current Assets', 'Primary', 0),
(7, 'Branch/Divisions', 'Primary', 0),
(8, 'Misc. Expenses (ASSET)', 'Primary', 0),
(9, 'Suspense A/c', 'Primary', 0),
(10, 'Sales Accounts', 'Primary', 0),
(11, 'Purchase Accounts', 'Primary', 0),
(12, 'Direct Incomes', 'Primary', 0),
(13, 'Direct Expenses', 'Primary', 0),
(14, 'Indirect Incomes', 'Primary', 0),
(15, 'Indirect Expenses', 'Primary', 0),
(59, 'Sundry Debtors', 'SubGroup', 6),
(60, 'Bank Accounts', 'SubGroup', 6),
(61, 'Cash-in-Hand', 'SubGroup', 6),
(62, 'Deposits (Asset)', 'SubGroup', 6),
(63, 'Stock-in-Hand', 'SubGroup', 6),
(64, 'Duties & Taxes', 'SubGroup', 3),
(65, 'Sundry Creditors', 'SubGroup', 3),
(66, 'Provisions', 'SubGroup', 3),
(67, 'Secured Loans', 'SubGroup', 2),
(68, 'Unsecured Loans', 'SubGroup', 2),
(69, 'Reserves & Surplus', 'SubGroup', 1),
(74, 'Sales Account', 'SubGroup', 10),
(75, 'Purchase Account', 'SubGroup', 11)
ON CONFLICT (grp_id) DO NOTHING;
SELECT setval('group_master_grp_id_seq', (SELECT MAX(grp_id) FROM group_master));

CREATE TABLE IF NOT EXISTS sub_group (
    sub_grp_id SERIAL PRIMARY KEY,
    grp_id INTEGER REFERENCES group_master(grp_id) ON DELETE CASCADE,
    sub_grp_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sub_group ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ledger (
    ledg_code SERIAL PRIMARY KEY,
    grp_id INTEGER REFERENCES group_master(grp_id),
    sub_grp_name VARCHAR(100),
    ledg_name VARCHAR(150) NOT NULL,
    print_name VARCHAR(150),
    street VARCHAR(200), add1 VARCHAR(200), add2 VARCHAR(200),
    city VARCHAR(50), dist VARCHAR(50), state VARCHAR(50),
    state_code VARCHAR(10), pin_code VARCHAR(10),
    gstin VARCHAR(50),
    reg_no INTEGER DEFAULT 0,
    pan_no VARCHAR(50), ph_no VARCHAR(50), cell_no VARCHAR(50), email VARCHAR(100),
    acc_type VARCHAR(20) DEFAULT 'Dr',
    op_bal NUMERIC(18,2) DEFAULT 0,
    op_bal_type VARCHAR(10) DEFAULT 'Dr',
    bal_amt NUMERIC(18,2) DEFAULT 0,
    bal_type VARCHAR(10) DEFAULT 'Dr',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_ledger_modtime BEFORE UPDATE ON ledger FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ledger_frm_code ON ledger(frm_code);
CREATE INDEX IF NOT EXISTS idx_ledger_grp_id ON ledger(grp_id);

CREATE TABLE IF NOT EXISTS ledg_opp_balance (
    ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    ledg_code INTEGER REFERENCES ledger(ledg_code) ON DELETE CASCADE,
    grp_id INTEGER,
    stk_as_on TIMESTAMPTZ,
    bill_char VARCHAR(50), bill_ref_no VARCHAR(50),
    opp_amt NUMERIC(18,2) DEFAULT 0,
    bal_type VARCHAR(10) DEFAULT 'Dr',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ledg_opp_balance ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ledg_opp_balance_ledg_code ON ledg_opp_balance(ledg_code);

CREATE TABLE IF NOT EXISTS receipt_master (
    rm_ref_no SERIAL PRIMARY KEY,
    rm_rec_no INTEGER,
    rm_cr_code INTEGER REFERENCES ledger(ledg_code),
    rm_bill_char VARCHAR(10),
    rm_bill_ref_no VARCHAR(50),
    rm_bill_date TIMESTAMPTZ,
    rm_narration VARCHAR(500),
    rm_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE receipt_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS receipt_child (
    rc_ref_no SERIAL PRIMARY KEY,
    rm_ref_no INTEGER REFERENCES receipt_master(rm_ref_no) ON DELETE CASCADE,
    rc_dr_code INTEGER REFERENCES ledger(ledg_code),
    rc_amount NUMERIC(18,2) DEFAULT 0,
    rc_narration VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE receipt_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS payment_master (
    pm_ref_no SERIAL PRIMARY KEY,
    pm_rec_no INTEGER,
    pm_dr_code INTEGER REFERENCES ledger(ledg_code),
    pm_bill_char VARCHAR(10),
    pm_bill_ref_no VARCHAR(50),
    pm_bill_date TIMESTAMPTZ,
    pm_narration VARCHAR(500),
    pm_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payment_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS payment_child (
    pc_ref_no SERIAL PRIMARY KEY,
    pm_ref_no INTEGER REFERENCES payment_master(pm_ref_no) ON DELETE CASCADE,
    pc_cr_code INTEGER REFERENCES ledger(ledg_code),
    pc_amount NUMERIC(18,2) DEFAULT 0,
    pc_narration VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payment_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS journal_master (
    jm_ref_no SERIAL PRIMARY KEY,
    jm_rec_no INTEGER,
    jm_bill_char VARCHAR(10),
    jm_bill_ref_no VARCHAR(50),
    jm_bill_date TIMESTAMPTZ,
    jm_narration VARCHAR(500),
    jm_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE journal_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS journal_child (
    jc_ref_no SERIAL PRIMARY KEY,
    jm_ref_no INTEGER REFERENCES journal_master(jm_ref_no) ON DELETE CASCADE,
    jc_ledg_code INTEGER REFERENCES ledger(ledg_code),
    jc_dr_amt NUMERIC(18,2) DEFAULT 0,
    jc_cr_amt NUMERIC(18,2) DEFAULT 0,
    jc_narration VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE journal_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS contra_master (
    cm_ref_no SERIAL PRIMARY KEY,
    cm_rec_no INTEGER,
    cm_bill_char VARCHAR(10),
    cm_bill_ref_no VARCHAR(50),
    cm_bill_date TIMESTAMPTZ,
    cm_narration VARCHAR(500),
    cm_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contra_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS contra_child (
    cc_ref_no SERIAL PRIMARY KEY,
    cm_ref_no INTEGER REFERENCES contra_master(cm_ref_no) ON DELETE CASCADE,
    cc_ledg_code INTEGER REFERENCES ledger(ledg_code),
    cc_dr_amt NUMERIC(18,2) DEFAULT 0,
    cc_cr_amt NUMERIC(18,2) DEFAULT 0,
    cc_narration VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contra_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS credit_note_master (
    cnm_ref_no SERIAL PRIMARY KEY,
    cnm_rec_no INTEGER,
    cnm_reg_code INTEGER DEFAULT 50,
    cnm_tax_model VARCHAR(50),
    cnm_cr_code INTEGER REFERENCES ledger(ledg_code),
    cnm_dr_code INTEGER REFERENCES ledger(ledg_code),
    cnm_bill_char VARCHAR(10),
    cnm_bill_ref_no VARCHAR(50),
    cnm_bill_date TIMESTAMPTZ,
    cnm_entry_date TIMESTAMPTZ DEFAULT NOW(),
    cnm_dr_narr VARCHAR(500),
    cnm_cr_narr VARCHAR(500),
    cnm_tot_qty NUMERIC(18,2) DEFAULT 0,
    cnm_grd_tot NUMERIC(18,2) DEFAULT 0,
    cnm_bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    cnm_igst_amt NUMERIC(18,2) DEFAULT 0,
    cnm_cgst_amt NUMERIC(18,2) DEFAULT 0,
    cnm_sgst_amt NUMERIC(18,2) DEFAULT 0,
    cnm_rnd_off NUMERIC(18,2) DEFAULT 0,
    cnm_net_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE credit_note_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS credit_note_child (
    cnc_ref_no SERIAL PRIMARY KEY,
    cnm_ref_no INTEGER REFERENCES credit_note_master(cnm_ref_no) ON DELETE CASCADE,
    cnc_prcode INTEGER,
    cnc_pgrcode INTEGER,
    cnc_qty NUMERIC(18,2) DEFAULT 0,
    cnc_rate NUMERIC(18,2) DEFAULT 0,
    cnc_disc_perc NUMERIC(18,2) DEFAULT 0,
    cnc_disc_amt NUMERIC(18,2) DEFAULT 0,
    cnc_total NUMERIC(18,2) DEFAULT 0,
    cnc_igst_perc NUMERIC(18,2) DEFAULT 0,
    cnc_igst_amt NUMERIC(18,2) DEFAULT 0,
    cnc_cgst_perc NUMERIC(18,2) DEFAULT 0,
    cnc_cgst_amt NUMERIC(18,2) DEFAULT 0,
    cnc_sgst_perc NUMERIC(18,2) DEFAULT 0,
    cnc_sgst_amt NUMERIC(18,2) DEFAULT 0,
    cnc_net_tot NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE credit_note_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS debit_note_master (
    dnm_ref_no SERIAL PRIMARY KEY,
    dnm_rec_no INTEGER,
    dnm_reg_code INTEGER DEFAULT 50,
    dnm_tax_model VARCHAR(50),
    dnm_cr_code INTEGER REFERENCES ledger(ledg_code),
    dnm_dr_code INTEGER REFERENCES ledger(ledg_code),
    dnm_bill_char VARCHAR(10),
    dnm_bill_ref_no VARCHAR(50),
    dnm_bill_date TIMESTAMPTZ,
    dnm_entry_date TIMESTAMPTZ DEFAULT NOW(),
    dnm_dr_narr VARCHAR(500),
    dnm_cr_narr VARCHAR(500),
    dnm_tot_qty NUMERIC(18,2) DEFAULT 0,
    dnm_grd_tot NUMERIC(18,2) DEFAULT 0,
    dnm_bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    dnm_igst_amt NUMERIC(18,2) DEFAULT 0,
    dnm_cgst_amt NUMERIC(18,2) DEFAULT 0,
    dnm_sgst_amt NUMERIC(18,2) DEFAULT 0,
    dnm_rnd_off NUMERIC(18,2) DEFAULT 0,
    dnm_net_total NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE debit_note_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS debit_note_child (
    dnc_ref_no SERIAL PRIMARY KEY,
    dnm_ref_no INTEGER REFERENCES debit_note_master(dnm_ref_no) ON DELETE CASCADE,
    dnc_prcode INTEGER,
    dnc_pgrcode INTEGER,
    dnc_qty NUMERIC(18,2) DEFAULT 0,
    dnc_rate NUMERIC(18,2) DEFAULT 0,
    dnc_disc_perc NUMERIC(18,2) DEFAULT 0,
    dnc_disc_amt NUMERIC(18,2) DEFAULT 0,
    dnc_total NUMERIC(18,2) DEFAULT 0,
    dnc_igst_perc NUMERIC(18,2) DEFAULT 0,
    dnc_igst_amt NUMERIC(18,2) DEFAULT 0,
    dnc_cgst_perc NUMERIC(18,2) DEFAULT 0,
    dnc_cgst_amt NUMERIC(18,2) DEFAULT 0,
    dnc_sgst_perc NUMERIC(18,2) DEFAULT 0,
    dnc_sgst_amt NUMERIC(18,2) DEFAULT 0,
    dnc_net_tot NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE debit_note_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS bill_adjustment (
    ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    ledg_code INTEGER REFERENCES ledger(ledg_code),
    bill_char VARCHAR(50),
    bill_ref_no VARCHAR(50),
    bill_date TIMESTAMPTZ,
    bill_amt NUMERIC(18,2) DEFAULT 0,
    adj_amt NUMERIC(18,2) DEFAULT 0,
    rate_diff NUMERIC(18,2) DEFAULT 0,
    disc_amt NUMERIC(18,2) DEFAULT 0,
    bal_amt NUMERIC(18,2) DEFAULT 0,
    adj_type VARCHAR(50),
    ref_bill_no VARCHAR(50),
    ref_bill_date TIMESTAMPTZ,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bill_adjustment ENABLE ROW LEVEL SECURITY;
-- 003_products_inventory.sql

CREATE TABLE IF NOT EXISTS units_master (
    id SERIAL PRIMARY KEY,
    unit_name VARCHAR(50) NOT NULL,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE units_master ENABLE ROW LEVEL SECURITY;

INSERT INTO units_master (unit_name) VALUES 
('Pcs'), ('Mtr'), ('Kg'), ('Nos'), ('Ltr'), ('Set'), ('Box'), ('Pair')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS product_group (
    ref_no SERIAL PRIMARY KEY,
    grp_code VARCHAR(50),
    grp_name VARCHAR(100) NOT NULL,
    hsn_code VARCHAR(50),
    gst_perc NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Primary',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE product_group ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_product_group_modtime BEFORE UPDATE ON product_group FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS product (
    ref_no SERIAL PRIMARY KEY,
    grp_code INTEGER REFERENCES product_group(ref_no),
    prd_code VARCHAR(50),
    prd_name VARCHAR(150) NOT NULL,
    bar_code VARCHAR(50),
    units VARCHAR(20) DEFAULT 'Pcs',
    min_stock NUMERIC(18,2) DEFAULT 0,
    max_stock NUMERIC(18,2) DEFAULT 0,
    re_order NUMERIC(18,2) DEFAULT 0,
    rate NUMERIC(18,2) DEFAULT 0,
    wages NUMERIC(18,2) DEFAULT 0,
    weight NUMERIC(18,3) DEFAULT 0,
    dis_perc NUMERIC(18,2) DEFAULT 0,
    sales_price NUMERIC(18,2) DEFAULT 0,
    tag_price NUMERIC(18,2) DEFAULT 0,
    margin_sale NUMERIC(18,2) DEFAULT 0,
    margin_tag NUMERIC(18,2) DEFAULT 0,
    is_stock VARCHAR(20) DEFAULT 'Yes',
    status VARCHAR(20) DEFAULT 'Active',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE product ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_product_modtime BEFORE UPDATE ON product FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_product_frm_code ON product(frm_code);
CREATE INDEX IF NOT EXISTS idx_product_grp_code ON product(grp_code);

CREATE TABLE IF NOT EXISTS colour_info (
    ref_no SERIAL PRIMARY KEY,
    colour_code VARCHAR(50),
    colour_name VARCHAR(100) NOT NULL,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE colour_info ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS design (
    ref_no SERIAL PRIMARY KEY,
    design_code VARCHAR(50),
    design_name VARCHAR(100) NOT NULL,
    reed VARCHAR(50), thread VARCHAR(50), card VARCHAR(50), mark VARCHAR(50),
    total_wt NUMERIC(18,3) DEFAULT 0,
    wages NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE design ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS warp_type (
    wt_no SERIAL PRIMARY KEY,
    warp_type VARCHAR(100) NOT NULL,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE warp_type ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS weft_type (
    ref_no SERIAL PRIMARY KEY,
    weft_type VARCHAR(100) NOT NULL,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE weft_type ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS warp_sheet (
    ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    wds_no INTEGER REFERENCES warp_type(wt_no),
    eds_no INTEGER REFERENCES weft_type(ref_no),
    d_no INTEGER REFERENCES product(ref_no),
    weave_name VARCHAR(100),
    warp_type_name VARCHAR(100),
    weft_type_name VARCHAR(100),
    wages NUMERIC(18,2) DEFAULT 0,
    warp_weight NUMERIC(18,3) DEFAULT 0,
    weft_weight NUMERIC(18,3) DEFAULT 0,
    zari_wt NUMERIC(18,3) DEFAULT 0,
    item_wt NUMERIC(18,3) DEFAULT 0,
    total_wt NUMERIC(18,3) DEFAULT 0,
    reed VARCHAR(50), thread VARCHAR(50), no_card VARCHAR(50), no_mark VARCHAR(50),
    dsn_body_img BYTEA, dsn_pallu_img BYTEA,
    grp_no INTEGER REFERENCES product_group(ref_no),
    no_qty NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE warp_sheet ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_warp_sheet_modtime BEFORE UPDATE ON warp_sheet FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS bar_temp (
    bar_ref_id SERIAL PRIMARY KEY,
    bar_no VARCHAR(50) UNIQUE,
    pc_ref_no INTEGER,
    prcode INTEGER REFERENCES product(ref_no),
    grp_code INTEGER REFERENCES product_group(ref_no),
    pc_pur_rate NUMERIC(18,2) DEFAULT 0,
    pc_sale_rate NUMERIC(18,2) DEFAULT 0,
    qty NUMERIC(18,2) DEFAULT 1,
    cr_code INTEGER,
    sold_status VARCHAR(10) DEFAULT 'A' CHECK (sold_status IN ('A', 'S')),
    bar_date TIMESTAMPTZ DEFAULT NOW(),
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bar_temp ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bar_temp_bar_no ON bar_temp(bar_no);
CREATE INDEX IF NOT EXISTS idx_bar_temp_sold_status ON bar_temp(sold_status);

CREATE TABLE IF NOT EXISTS prod_opp_bal (
    ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    grp_code INTEGER REFERENCES product_group(ref_no),
    prd_code INTEGER REFERENCES product(ref_no),
    cr_code INTEGER,
    stk_as_on TIMESTAMPTZ,
    bill_char VARCHAR(50), bill_ref_no VARCHAR(50),
    opp_qty NUMERIC(18,2) DEFAULT 0,
    prate NUMERIC(18,2) DEFAULT 0,
    value NUMERIC(18,2) DEFAULT 0,
    srate NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Active',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE prod_opp_bal ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS yarn_opp (
    ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    grp_code INTEGER REFERENCES product_group(ref_no),
    yrn_code INTEGER REFERENCES product(ref_no),
    cr_code INTEGER,
    stk_as_on TIMESTAMPTZ,
    bill_char VARCHAR(50), bill_ref_no VARCHAR(50),
    opp_qty NUMERIC(18,2) DEFAULT 0,
    prate NUMERIC(18,2) DEFAULT 0,
    value NUMERIC(18,2) DEFAULT 0,
    srate NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Active',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE yarn_opp ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS stock_journal (
    ref_no SERIAL PRIMARY KEY,
    stk_date TIMESTAMPTZ,
    ds_no INTEGER REFERENCES product(ref_no),
    grp_no INTEGER REFERENCES product_group(ref_no),
    units VARCHAR(20),
    qty NUMERIC(18,2) DEFAULT 0,
    rate NUMERIC(18,2) DEFAULT 0,
    stock_amt NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stock_journal ENABLE ROW LEVEL SECURITY;
-- 004_purchase.sql

CREATE TABLE IF NOT EXISTS tax_reg (
    reg_code INTEGER PRIMARY KEY,
    reg_det VARCHAR(100)
);
ALTER TABLE tax_reg ENABLE ROW LEVEL SECURITY;

INSERT INTO tax_reg (reg_code, reg_det) VALUES 
(50, 'Local-IntraState'),
(51, 'Other-InterState')
ON CONFLICT (reg_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS tax_setup (
    tax_id SERIAL PRIMARY KEY,
    tax_reg_code INTEGER REFERENCES tax_reg(reg_code),
    tax_head_code INTEGER REFERENCES ledger(ledg_code),
    tax_cgst_code INTEGER,
    cgst_perc NUMERIC(18,2) DEFAULT 0,
    tax_sgst_code INTEGER,
    sgst_perc NUMERIC(18,2) DEFAULT 0,
    tax_igst_code INTEGER,
    igst_perc NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tax_setup ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS prod_tax_setup (
    tax_id SERIAL PRIMARY KEY,
    prd_code INTEGER REFERENCES product(ref_no),
    cgst_reg_code INTEGER DEFAULT 50,
    sl_cgst_perc NUMERIC(18,2) DEFAULT 0,
    sgst_reg_code INTEGER DEFAULT 50,
    sl_sgst_perc NUMERIC(18,2) DEFAULT 0,
    igst_reg_code INTEGER DEFAULT 51,
    sl_igst_perc NUMERIC(18,2) DEFAULT 0,
    pu_cgst_perc NUMERIC(18,2) DEFAULT 0,
    pu_sgst_perc NUMERIC(18,2) DEFAULT 0,
    pu_igst_perc NUMERIC(18,2) DEFAULT 0,
    hsn_code VARCHAR(50),
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE prod_tax_setup ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sac_tax_setup (
    ref_no SERIAL PRIMARY KEY,
    item_name VARCHAR(150),
    ledg_code INTEGER REFERENCES ledger(ledg_code),
    hsn_code VARCHAR(50),
    cgst_perc NUMERIC(18,2) DEFAULT 0,
    sgst_perc NUMERIC(18,2) DEFAULT 0,
    igst_perc NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sac_tax_setup ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS pur_mast (
    pm_ref_no SERIAL PRIMARY KEY,
    pm_rec_no INTEGER,
    pm_reg_code INTEGER DEFAULT 50,
    pm_tax_model VARCHAR(50),
    pm_cr_code INTEGER REFERENCES ledger(ledg_code),
    pm_dr_code INTEGER REFERENCES ledger(ledg_code),
    pm_bill_char VARCHAR(10),
    pm_bill_ref_no VARCHAR(50),
    pm_bill_date TIMESTAMPTZ,
    pm_entry_date TIMESTAMPTZ DEFAULT NOW(),
    pm_dr_narr VARCHAR(500),
    pm_cr_narr VARCHAR(500),
    pm_tot_qty NUMERIC(18,2) DEFAULT 0,
    pm_grd_tot NUMERIC(18,2) DEFAULT 0,
    pm_bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    pm_igst_amt NUMERIC(18,2) DEFAULT 0,
    pm_cgst_amt NUMERIC(18,2) DEFAULT 0,
    pm_sgst_amt NUMERIC(18,2) DEFAULT 0,
    pm_rnd_off NUMERIC(18,2) DEFAULT 0,
    pm_net_total NUMERIC(18,2) DEFAULT 0,
    pm_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pur_mast ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pur_mast_frm_code ON pur_mast(pm_frm_code);

CREATE TABLE IF NOT EXISTS pur_child (
    pc_ref_no SERIAL PRIMARY KEY,
    pm_ref_no INTEGER REFERENCES pur_mast(pm_ref_no) ON DELETE CASCADE,
    pc_bill_date TIMESTAMPTZ,
    pc_prcode INTEGER REFERENCES product(ref_no),
    pc_pgrcode INTEGER REFERENCES product_group(ref_no),
    pc_qty NUMERIC(18,2) DEFAULT 0,
    pc_pur_rate NUMERIC(18,2) DEFAULT 0,
    pc_sale_rate NUMERIC(18,2) DEFAULT 0,
    pc_tag_rate NUMERIC(18,2) DEFAULT 0,
    pc_dis_perc NUMERIC(18,2) DEFAULT 0,
    pc_disc_amt NUMERIC(18,2) DEFAULT 0,
    pc_total NUMERIC(18,2) DEFAULT 0,
    pc_net_tot NUMERIC(18,2) DEFAULT 0,
    pc_igst_perc NUMERIC(18,2) DEFAULT 0,
    pc_igst_amt NUMERIC(18,2) DEFAULT 0,
    pc_cgst_perc NUMERIC(18,2) DEFAULT 0,
    pc_cgst_amt NUMERIC(18,2) DEFAULT 0,
    pc_sgst_perc NUMERIC(18,2) DEFAULT 0,
    pc_sgst_amt NUMERIC(18,2) DEFAULT 0,
    cr_code INTEGER,
    dr_code INTEGER,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pur_child ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pur_child_pm_ref_no ON pur_child(pm_ref_no);

CREATE TABLE IF NOT EXISTS pur_ret_mast (
    prm_ref_no SERIAL PRIMARY KEY,
    prm_rec_no INTEGER,
    prm_reg_code INTEGER DEFAULT 50,
    prm_tax_model VARCHAR(50),
    prm_cr_code INTEGER REFERENCES ledger(ledg_code),
    prm_dr_code INTEGER REFERENCES ledger(ledg_code),
    prm_bill_char VARCHAR(10),
    prm_bill_ref_no VARCHAR(50),
    prm_bill_date TIMESTAMPTZ,
    prm_entry_date TIMESTAMPTZ DEFAULT NOW(),
    prm_dr_narr VARCHAR(500),
    prm_cr_narr VARCHAR(500),
    prm_tot_qty NUMERIC(18,2) DEFAULT 0,
    prm_grd_tot NUMERIC(18,2) DEFAULT 0,
    prm_bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    prm_igst_amt NUMERIC(18,2) DEFAULT 0,
    prm_cgst_amt NUMERIC(18,2) DEFAULT 0,
    prm_sgst_amt NUMERIC(18,2) DEFAULT 0,
    prm_rnd_off NUMERIC(18,2) DEFAULT 0,
    prm_net_total NUMERIC(18,2) DEFAULT 0,
    prm_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pur_ret_mast ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS pur_ret_child (
    prc_ref_no SERIAL PRIMARY KEY,
    prm_ref_no INTEGER REFERENCES pur_ret_mast(prm_ref_no) ON DELETE CASCADE,
    prc_bill_date TIMESTAMPTZ,
    prc_prcode INTEGER REFERENCES product(ref_no),
    prc_pgrcode INTEGER REFERENCES product_group(ref_no),
    prc_qty NUMERIC(18,2) DEFAULT 0,
    prc_pur_rate NUMERIC(18,2) DEFAULT 0,
    prc_sale_rate NUMERIC(18,2) DEFAULT 0,
    prc_tag_rate NUMERIC(18,2) DEFAULT 0,
    prc_dis_perc NUMERIC(18,2) DEFAULT 0,
    prc_disc_amt NUMERIC(18,2) DEFAULT 0,
    prc_total NUMERIC(18,2) DEFAULT 0,
    prc_net_tot NUMERIC(18,2) DEFAULT 0,
    prc_igst_perc NUMERIC(18,2) DEFAULT 0,
    prc_igst_amt NUMERIC(18,2) DEFAULT 0,
    prc_cgst_perc NUMERIC(18,2) DEFAULT 0,
    prc_cgst_amt NUMERIC(18,2) DEFAULT 0,
    prc_sgst_perc NUMERIC(18,2) DEFAULT 0,
    prc_sgst_amt NUMERIC(18,2) DEFAULT 0,
    cr_code INTEGER,
    dr_code INTEGER,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pur_ret_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS inward (
    pc_ref_no SERIAL PRIMARY KEY,
    pc_rec_no INTEGER,
    pc_prcode INTEGER REFERENCES product(ref_no),
    pc_pgrcode INTEGER REFERENCES product_group(ref_no),
    pc_bill_date TIMESTAMPTZ,
    pc_qty NUMERIC(18,2) DEFAULT 0,
    pc_pc_rate NUMERIC(18,2) DEFAULT 0,
    pc_tag_rate NUMERIC(18,2) DEFAULT 0,
    cr_code INTEGER,
    status VARCHAR(20) DEFAULT 'NotPrint',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inward ENABLE ROW LEVEL SECURITY;
-- 005_retail_sales.sql

CREATE TABLE IF NOT EXISTS estimate_mast (
    em_ref_no SERIAL PRIMARY KEY,
    em_rec_no INTEGER,
    em_char VARCHAR(10),
    em_inv_no VARCHAR(50),
    cust_name VARCHAR(150),
    city VARCHAR(50), dist VARCHAR(50), state VARCHAR(50), state_code VARCHAR(10),
    ph_no VARCHAR(50), gstin VARCHAR(50),
    staff_code INTEGER,
    est_date TIMESTAMPTZ DEFAULT NOW(),
    em_qty NUMERIC(18,2) DEFAULT 0,
    em_gnd_tot NUMERIC(18,2) DEFAULT 0,
    add_less_exp1 VARCHAR(100),
    add_exp1_amt NUMERIC(18,2) DEFAULT 0,
    add_less_exp2 VARCHAR(100),
    add_exp2_amt NUMERIC(18,2) DEFAULT 0,
    em_rnd_off NUMERIC(18,2) DEFAULT 0,
    em_net_total NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Pending',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE estimate_mast ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS estimate_child (
    est_ref_no SERIAL PRIMARY KEY,
    em_ref_no INTEGER REFERENCES estimate_mast(em_ref_no) ON DELETE CASCADE,
    bill_no VARCHAR(50), bill_date TIMESTAMPTZ,
    bar_no VARCHAR(50),
    prcode INTEGER REFERENCES product(ref_no),
    grp_code INTEGER REFERENCES product_group(ref_no),
    qty NUMERIC(18,2) DEFAULT 0,
    rate NUMERIC(18,2) DEFAULT 0,
    disc_perc NUMERIC(18,2) DEFAULT 0,
    disc_amt NUMERIC(18,2) DEFAULT 0,
    net_amt NUMERIC(18,2) DEFAULT 0,
    bar_ref_id INTEGER,
    cr_code INTEGER,
    pc_ref_no INTEGER,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE estimate_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS retail_sale_mast (
    rm_ref_no SERIAL PRIMARY KEY,
    rm_rec_no INTEGER,
    em_ref_no INTEGER REFERENCES estimate_mast(em_ref_no),
    em_bill_no VARCHAR(50),
    reg_code INTEGER DEFAULT 50,
    rm_tax_model VARCHAR(50),
    rev_chrg VARCHAR(10) DEFAULT 'No',
    inv_type VARCHAR(50),
    cust_name VARCHAR(150),
    city VARCHAR(50), dist VARCHAR(50), state VARCHAR(50), state_code VARCHAR(10),
    gstin VARCHAR(50), rm_ph_no VARCHAR(50),
    rm_cr_code INTEGER REFERENCES ledger(ledg_code),
    rm_mode_one VARCHAR(50) DEFAULT 'Cash',
    rm_dr_code_one INTEGER REFERENCES ledger(ledg_code),
    rm_recd_one_amt NUMERIC(18,2) DEFAULT 0,
    rm_dbt_dt_one TIMESTAMPTZ,
    rm_mode_two VARCHAR(50),
    rm_dr_code_two INTEGER,
    rm_recd_two_amt NUMERIC(18,2) DEFAULT 0,
    rm_dbt_dt_two TIMESTAMPTZ,
    rm_bill_char VARCHAR(10),
    rm_bill_ref_no VARCHAR(50),
    rm_bill_date TIMESTAMPTZ,
    rm_dr_narr VARCHAR(500),
    rm_cr_narr VARCHAR(500),
    rm_tot_qty NUMERIC(18,2) DEFAULT 0,
    rm_grd_tot NUMERIC(18,2) DEFAULT 0,
    rm_bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    rm_igst_amt NUMERIC(18,2) DEFAULT 0,
    rm_cgst_amt NUMERIC(18,2) DEFAULT 0,
    rm_sgst_amt NUMERIC(18,2) DEFAULT 0,
    rm_rnd_off NUMERIC(18,2) DEFAULT 0,
    rm_net_total NUMERIC(18,2) DEFAULT 0,
    rm_igst_code INTEGER, rm_cgst_code INTEGER, rm_sgst_code INTEGER, rnd_code INTEGER,
    rm_igst_perc NUMERIC(18,2) DEFAULT 0,
    rm_cgst_perc NUMERIC(18,2) DEFAULT 0,
    rm_sgst_perc NUMERIC(18,2) DEFAULT 0,
    rm_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE retail_sale_mast ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS retail_sale_child (
    dc_ref_no SERIAL PRIMARY KEY,
    rm_ref_no INTEGER REFERENCES retail_sale_mast(rm_ref_no) ON DELETE CASCADE,
    rm_bill_no VARCHAR(50),
    rm_bill_date TIMESTAMPTZ,
    dc_bar_no VARCHAR(50),
    dc_prcode INTEGER REFERENCES product(ref_no),
    dc_pgrcode INTEGER REFERENCES product_group(ref_no),
    dc_qty NUMERIC(18,2) DEFAULT 0,
    dc_rate NUMERIC(18,2) DEFAULT 0,
    dc_net_tot NUMERIC(18,2) DEFAULT 0,
    dc_igst_perc NUMERIC(18,2) DEFAULT 0,
    dc_igst_amnt NUMERIC(18,2) DEFAULT 0,
    dc_cgst_perc NUMERIC(18,2) DEFAULT 0,
    dc_cgst_amnt NUMERIC(18,2) DEFAULT 0,
    dc_sgst_perc NUMERIC(18,2) DEFAULT 0,
    dc_sgst_amnt NUMERIC(18,2) DEFAULT 0,
    bar_ref_id INTEGER,
    cr_code INTEGER,
    pc_ref_no INTEGER,
    emp_no INTEGER,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE retail_sale_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS retail_sale_ret_mast (
    rr_ref_no SERIAL PRIMARY KEY,
    rr_rec_no INTEGER,
    em_ref_no INTEGER,
    em_bill_no VARCHAR(50),
    reg_code INTEGER DEFAULT 50,
    rr_tax_model VARCHAR(50),
    rev_chrg VARCHAR(10) DEFAULT 'No',
    inv_type VARCHAR(50),
    cust_name VARCHAR(150),
    city VARCHAR(50), dist VARCHAR(50), state VARCHAR(50), state_code VARCHAR(10),
    gstin VARCHAR(50), rr_ph_no VARCHAR(50),
    rr_cr_code INTEGER REFERENCES ledger(ledg_code),
    rr_mode_one VARCHAR(50) DEFAULT 'Cash',
    rr_dr_code_one INTEGER REFERENCES ledger(ledg_code),
    rr_recd_one_amt NUMERIC(18,2) DEFAULT 0,
    rr_dbt_dt_one TIMESTAMPTZ,
    rr_mode_two VARCHAR(50),
    rr_dr_code_two INTEGER,
    rr_recd_two_amt NUMERIC(18,2) DEFAULT 0,
    rr_dbt_dt_two TIMESTAMPTZ,
    rr_bill_char VARCHAR(10),
    rr_bill_ref_no VARCHAR(50),
    rr_bill_date TIMESTAMPTZ,
    rr_dr_narr VARCHAR(500),
    rr_cr_narr VARCHAR(500),
    rr_tot_qty NUMERIC(18,2) DEFAULT 0,
    rr_grd_tot NUMERIC(18,2) DEFAULT 0,
    rr_bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    rr_igst_amt NUMERIC(18,2) DEFAULT 0,
    rr_cgst_amt NUMERIC(18,2) DEFAULT 0,
    rr_sgst_amt NUMERIC(18,2) DEFAULT 0,
    rr_rnd_off NUMERIC(18,2) DEFAULT 0,
    rr_net_total NUMERIC(18,2) DEFAULT 0,
    rr_igst_code INTEGER, rr_cgst_code INTEGER, rr_sgst_code INTEGER, rnd_code INTEGER,
    rr_igst_perc NUMERIC(18,2) DEFAULT 0,
    rr_cgst_perc NUMERIC(18,2) DEFAULT 0,
    rr_sgst_perc NUMERIC(18,2) DEFAULT 0,
    rr_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE retail_sale_ret_mast ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS retail_sale_ret_child (
    dc_ref_no SERIAL PRIMARY KEY,
    rr_ref_no INTEGER REFERENCES retail_sale_ret_mast(rr_ref_no) ON DELETE CASCADE,
    rr_bill_no VARCHAR(50),
    rr_bill_date TIMESTAMPTZ,
    dc_bar_no VARCHAR(50),
    dc_prcode INTEGER REFERENCES product(ref_no),
    dc_pgrcode INTEGER REFERENCES product_group(ref_no),
    dc_qty NUMERIC(18,2) DEFAULT 0,
    dc_rate NUMERIC(18,2) DEFAULT 0,
    dc_net_tot NUMERIC(18,2) DEFAULT 0,
    dc_igst_perc NUMERIC(18,2) DEFAULT 0,
    dc_igst_amnt NUMERIC(18,2) DEFAULT 0,
    dc_cgst_perc NUMERIC(18,2) DEFAULT 0,
    dc_cgst_amnt NUMERIC(18,2) DEFAULT 0,
    dc_sgst_perc NUMERIC(18,2) DEFAULT 0,
    dc_sgst_amnt NUMERIC(18,2) DEFAULT 0,
    bar_ref_id INTEGER,
    cr_code INTEGER,
    pc_ref_no INTEGER,
    emp_no INTEGER,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE retail_sale_ret_child ENABLE ROW LEVEL SECURITY;
-- 006_wholesale.sql

CREATE TABLE IF NOT EXISTS del_chall_mast (
    del_ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    reg_code INTEGER DEFAULT 50,
    tax_model VARCHAR(50),
    dr_code INTEGER REFERENCES ledger(ledg_code),
    cr_code INTEGER REFERENCES ledger(ledg_code),
    bill_char VARCHAR(10),
    bill_ref_no VARCHAR(50),
    bill_date TIMESTAMPTZ,
    tot_qty NUMERIC(18,2) DEFAULT 0,
    grd_tot NUMERIC(18,2) DEFAULT 0,
    add_less_exp1 VARCHAR(100),
    add_exp1_amt NUMERIC(18,2) DEFAULT 0,
    add_exp2_code INTEGER,
    add_less_exp2 VARCHAR(100),
    add_exp2_amt NUMERIC(18,2) DEFAULT 0,
    bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    igst_code INTEGER, igst_perc NUMERIC(18,2) DEFAULT 0, igst_amt NUMERIC(18,2) DEFAULT 0,
    cgst_code INTEGER, cgst_perc NUMERIC(18,2) DEFAULT 0, cgst_amt NUMERIC(18,2) DEFAULT 0,
    sgst_code INTEGER, sgst_perc NUMERIC(18,2) DEFAULT 0, sgst_amt NUMERIC(18,2) DEFAULT 0,
    rnd_off NUMERIC(18,2) DEFAULT 0,
    net_total NUMERIC(18,2) DEFAULT 0,
    rnd_code INTEGER,
    status VARCHAR(50) DEFAULT 'Pending',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE del_chall_mast ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS del_chall_child (
    ref_no SERIAL PRIMARY KEY,
    del_ref_no INTEGER REFERENCES del_chall_mast(del_ref_no) ON DELETE CASCADE,
    prcode INTEGER REFERENCES product(ref_no),
    grcode INTEGER REFERENCES product_group(ref_no),
    qty NUMERIC(18,2) DEFAULT 0,
    rate NUMERIC(18,2) DEFAULT 0,
    disc_perc NUMERIC(18,2) DEFAULT 0, disc_amt NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    igst_perc NUMERIC(18,2) DEFAULT 0, igst_amnt NUMERIC(18,2) DEFAULT 0,
    cgst_perc NUMERIC(18,2) DEFAULT 0, cgst_amnt NUMERIC(18,2) DEFAULT 0,
    sgst_perc NUMERIC(18,2) DEFAULT 0, sgst_amnt NUMERIC(18,2) DEFAULT 0,
    net_tot NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE del_chall_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS wholesale_mast (
    whl_ref_no SERIAL PRIMARY KEY,
    del_ref_no INTEGER REFERENCES del_chall_mast(del_ref_no),
    rec_no INTEGER,
    reg_code INTEGER DEFAULT 50,
    tax_model VARCHAR(50),
    cr_code INTEGER REFERENCES ledger(ledg_code),
    dr_code INTEGER REFERENCES ledger(ledg_code),
    dc_no VARCHAR(50),
    order_no VARCHAR(50),
    rev_chrg VARCHAR(10) DEFAULT 'No',
    inv_type VARCHAR(50),
    eway_bill_no VARCHAR(50),
    ewb_dt TIMESTAMPTZ,
    transport VARCHAR(100),
    trans_id VARCHAR(50), trans_name VARCHAR(100),
    trans_mode VARCHAR(50), distance VARCHAR(50),
    trans_doc_no VARCHAR(50), trans_doc_dt TIMESTAMPTZ,
    veh_no VARCHAR(50), veh_type VARCHAR(50),
    bill_char VARCHAR(10),
    bill_ref_no VARCHAR(50),
    bill_date TIMESTAMPTZ,
    tot_qty NUMERIC(18,2) DEFAULT 0,
    grd_tot NUMERIC(18,2) DEFAULT 0,
    dr_narr VARCHAR(500), cr_narr VARCHAR(500),
    add_less_exp1 VARCHAR(100),
    add_exp1_amt NUMERIC(18,2) DEFAULT 0,
    add_exp2_code INTEGER,
    add_less_exp2 VARCHAR(100),
    add_exp2_amt NUMERIC(18,2) DEFAULT 0,
    bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    igst_code INTEGER, igst_perc NUMERIC(18,2) DEFAULT 0, igst_amt NUMERIC(18,2) DEFAULT 0,
    cgst_code INTEGER, cgst_perc NUMERIC(18,2) DEFAULT 0, cgst_amt NUMERIC(18,2) DEFAULT 0,
    sgst_code INTEGER, sgst_perc NUMERIC(18,2) DEFAULT 0, sgst_amt NUMERIC(18,2) DEFAULT 0,
    rnd_off NUMERIC(18,2) DEFAULT 0,
    net_total NUMERIC(18,2) DEFAULT 0,
    rnd_code INTEGER,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wholesale_mast ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS wholesale_child (
    ref_no SERIAL PRIMARY KEY,
    whl_ref_no INTEGER REFERENCES wholesale_mast(whl_ref_no) ON DELETE CASCADE,
    prcode INTEGER REFERENCES product(ref_no),
    grcode INTEGER REFERENCES product_group(ref_no),
    qty NUMERIC(18,2) DEFAULT 0,
    rate NUMERIC(18,2) DEFAULT 0,
    disc_perc NUMERIC(18,2) DEFAULT 0, disc_amt NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    igst_perc NUMERIC(18,2) DEFAULT 0, igst_amnt NUMERIC(18,2) DEFAULT 0,
    cgst_perc NUMERIC(18,2) DEFAULT 0, cgst_amnt NUMERIC(18,2) DEFAULT 0,
    sgst_perc NUMERIC(18,2) DEFAULT 0, sgst_amnt NUMERIC(18,2) DEFAULT 0,
    net_tot NUMERIC(18,2) DEFAULT 0,
    dr_code INTEGER,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wholesale_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS wholesale_ret_mast (
    whr_ref_no SERIAL PRIMARY KEY,
    del_ref_no INTEGER,
    rec_no INTEGER,
    reg_code INTEGER DEFAULT 50,
    tax_model VARCHAR(50),
    cr_code INTEGER REFERENCES ledger(ledg_code),
    dr_code INTEGER REFERENCES ledger(ledg_code),
    dc_no VARCHAR(50),
    order_no VARCHAR(50),
    rev_chrg VARCHAR(10) DEFAULT 'No',
    inv_type VARCHAR(50),
    eway_bill_no VARCHAR(50),
    ewb_dt TIMESTAMPTZ,
    transport VARCHAR(100),
    trans_id VARCHAR(50), trans_name VARCHAR(100),
    trans_mode VARCHAR(50), distance VARCHAR(50),
    trans_doc_no VARCHAR(50), trans_doc_dt TIMESTAMPTZ,
    veh_no VARCHAR(50), veh_type VARCHAR(50),
    bill_char VARCHAR(10),
    bill_ref_no VARCHAR(50),
    bill_date TIMESTAMPTZ,
    tot_qty NUMERIC(18,2) DEFAULT 0,
    grd_tot NUMERIC(18,2) DEFAULT 0,
    dr_narr VARCHAR(500), cr_narr VARCHAR(500),
    add_less_exp1 VARCHAR(100),
    add_exp1_amt NUMERIC(18,2) DEFAULT 0,
    add_exp2_code INTEGER,
    add_less_exp2 VARCHAR(100),
    add_exp2_amt NUMERIC(18,2) DEFAULT 0,
    bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    igst_code INTEGER, igst_perc NUMERIC(18,2) DEFAULT 0, igst_amt NUMERIC(18,2) DEFAULT 0,
    cgst_code INTEGER, cgst_perc NUMERIC(18,2) DEFAULT 0, cgst_amt NUMERIC(18,2) DEFAULT 0,
    sgst_code INTEGER, sgst_perc NUMERIC(18,2) DEFAULT 0, sgst_amt NUMERIC(18,2) DEFAULT 0,
    rnd_off NUMERIC(18,2) DEFAULT 0,
    net_total NUMERIC(18,2) DEFAULT 0,
    rnd_code INTEGER,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wholesale_ret_mast ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS wholesale_ret_child (
    ref_no SERIAL PRIMARY KEY,
    whr_ref_no INTEGER REFERENCES wholesale_ret_mast(whr_ref_no) ON DELETE CASCADE,
    prcode INTEGER REFERENCES product(ref_no),
    grcode INTEGER REFERENCES product_group(ref_no),
    qty NUMERIC(18,2) DEFAULT 0,
    rate NUMERIC(18,2) DEFAULT 0,
    disc_perc NUMERIC(18,2) DEFAULT 0, disc_amt NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    igst_perc NUMERIC(18,2) DEFAULT 0, igst_amnt NUMERIC(18,2) DEFAULT 0,
    cgst_perc NUMERIC(18,2) DEFAULT 0, cgst_amnt NUMERIC(18,2) DEFAULT 0,
    sgst_perc NUMERIC(18,2) DEFAULT 0, sgst_amnt NUMERIC(18,2) DEFAULT 0,
    net_tot NUMERIC(18,2) DEFAULT 0,
    dr_code INTEGER,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wholesale_ret_child ENABLE ROW LEVEL SECURITY;
-- 007_manufacturing.sql

CREATE TABLE IF NOT EXISTS lot_info (
    lot_ref_no SERIAL PRIMARY KEY,
    lot_no INTEGER,
    cr_code INTEGER REFERENCES ledger(ledg_code),
    lot_name VARCHAR(100),
    lot_date TIMESTAMPTZ DEFAULT NOW(),
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE lot_info ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS twist_master (
    tm_ref_no SERIAL PRIMARY KEY,
    tm_rec_no INTEGER,
    tm_cr_code INTEGER REFERENCES ledger(ledg_code),
    tm_dr_code INTEGER REFERENCES ledger(ledg_code),
    tm_issue_date TIMESTAMPTZ,
    tm_tot_weight NUMERIC(18,3) DEFAULT 0,
    tm_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE twist_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS twist_child (
    tc_ref_no SERIAL PRIMARY KEY,
    tm_ref_no INTEGER REFERENCES twist_master(tm_ref_no) ON DELETE CASCADE,
    tm_itm_no INTEGER REFERENCES product(ref_no),
    tm_itm_grp_no INTEGER REFERENCES product_group(ref_no),
    tm_yarn_type VARCHAR(100),
    tm_weight NUMERIC(18,3) DEFAULT 0,
    tm_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE twist_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS twist_recd_master (
    tr_ref_no SERIAL PRIMARY KEY,
    tr_rec_no INTEGER,
    tm_cr_code INTEGER REFERENCES ledger(ledg_code),
    tr_recd_date TIMESTAMPTZ,
    tr_tot_weight NUMERIC(18,3) DEFAULT 0,
    tr_wages NUMERIC(18,2) DEFAULT 0,
    tr_tot_amount NUMERIC(18,2) DEFAULT 0,
    tr_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE twist_recd_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS twist_recd_child (
    rc_ref_no SERIAL PRIMARY KEY,
    tr_ref_no INTEGER REFERENCES twist_recd_master(tr_ref_no) ON DELETE CASCADE,
    tm_itm_no INTEGER REFERENCES product(ref_no),
    tr_weight NUMERIC(18,3) DEFAULT 0,
    tr_wages_rate NUMERIC(18,2) DEFAULT 0,
    tr_amount NUMERIC(18,2) DEFAULT 0,
    tr_warp_dsn_no INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE twist_recd_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS dyeing_issue_master (
    dm_ref_no SERIAL PRIMARY KEY,
    dm_rec_no INTEGER,
    dm_cr_no INTEGER REFERENCES ledger(ledg_code),
    dm_dr_no INTEGER REFERENCES ledger(ledg_code),
    dm_date TIMESTAMPTZ,
    dm_tot_weight NUMERIC(18,3) DEFAULT 0,
    dm_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE dyeing_issue_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS dyeing_issue_child (
    dc_ref_no SERIAL PRIMARY KEY,
    dm_ref_no INTEGER REFERENCES dyeing_issue_master(dm_ref_no) ON DELETE CASCADE,
    dm_itm_no INTEGER REFERENCES product(ref_no),
    dm_itm_grp_no INTEGER REFERENCES product_group(ref_no),
    dm_weight NUMERIC(18,3) DEFAULT 0,
    dm_rate NUMERIC(18,2) DEFAULT 0,
    dm_total NUMERIC(18,2) DEFAULT 0,
    dm_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE dyeing_issue_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS dyeing_recd_master (
    dr_ref_no SERIAL PRIMARY KEY,
    dr_rec_no INTEGER,
    dm_cr_no INTEGER REFERENCES ledger(ledg_code),
    dr_date TIMESTAMPTZ,
    dr_tot_weight NUMERIC(18,3) DEFAULT 0,
    dm_waste NUMERIC(18,3) DEFAULT 0,
    dm_wages_tot NUMERIC(18,2) DEFAULT 0,
    dr_frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE dyeing_recd_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS dyeing_recd_child (
    rc_ref_no SERIAL PRIMARY KEY,
    dr_ref_no INTEGER REFERENCES dyeing_recd_master(dr_ref_no) ON DELETE CASCADE,
    dm_itm_no INTEGER REFERENCES product(ref_no),
    dr_weight NUMERIC(18,3) DEFAULT 0,
    dm_wages NUMERIC(18,2) DEFAULT 0,
    dm_amount NUMERIC(18,2) DEFAULT 0,
    dm_clr_no INTEGER REFERENCES colour_info(ref_no),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE dyeing_recd_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS loom (
    loom_no SERIAL PRIMARY KEY,
    w_cr_code INTEGER REFERENCES ledger(ledg_code),
    p_ds_no INTEGER,
    w_ds_no INTEGER,
    wds_ref_no INTEGER REFERENCES warp_sheet(ref_no),
    sub_weav_name VARCHAR(100),
    pay_no INTEGER,
    remarks VARCHAR(250),
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE loom ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS weav_master (
    weav_id SERIAL PRIMARY KEY,
    weaver_no INTEGER REFERENCES ledger(ledg_code),
    loom_no INTEGER REFERENCES loom(loom_no),
    pds_no INTEGER, wds_no INTEGER,
    warp_date TIMESTAMPTZ,
    warp_qty NUMERIC(18,2) DEFAULT 0,
    new_flag VARCHAR(10) DEFAULT 'Yes',
    running VARCHAR(10) DEFAULT 'No',
    completed VARCHAR(10) DEFAULT 'No',
    status VARCHAR(20) DEFAULT 'Running',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE weav_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS weaving_trans (
    trans_id SERIAL PRIMARY KEY,
    weav_mast_id INTEGER REFERENCES weav_master(weav_id),
    weaver_code INTEGER REFERENCES ledger(ledg_code),
    loom_no INTEGER,
    entry_type VARCHAR(50),
    details VARCHAR(250),
    warp_qty NUMERIC(18,3) DEFAULT 0,
    issued_wt NUMERIC(18,3) DEFAULT 0,
    recd_qty NUMERIC(18,3) DEFAULT 0,
    recd_wt NUMERIC(18,3) DEFAULT 0,
    debit NUMERIC(18,2) DEFAULT 0,
    credit NUMERIC(18,2) DEFAULT 0,
    narration VARCHAR(250),
    dye_recd_ref_no INTEGER,
    out_qty NUMERIC(18,2) DEFAULT 0,
    itm_ref_no INTEGER REFERENCES product(ref_no),
    trans_date TIMESTAMPTZ DEFAULT NOW(),
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE weaving_trans ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_weaving_trans_weav_mast_id ON weaving_trans(weav_mast_id);
CREATE INDEX IF NOT EXISTS idx_weaving_trans_weaver_code ON weaving_trans(weaver_code);

CREATE TABLE IF NOT EXISTS weaver_pay_setting (
    id SERIAL PRIMARY KEY,
    mw_no INTEGER REFERENCES ledger(ledg_code),
    l_no INTEGER REFERENCES loom(loom_no),
    payee_name VARCHAR(100),
    warp_id INTEGER REFERENCES weav_master(weav_id),
    pay_bank INTEGER REFERENCES ledger(ledg_code),
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE weaver_pay_setting ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS weav_pay_confirm (
    id SERIAL PRIMARY KEY,
    pay_dt TIMESTAMPTZ,
    mw_no INTEGER REFERENCES ledger(ledg_code),
    pay_no INTEGER,
    weav_acc_name VARCHAR(100),
    recd_amt NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE weav_pay_confirm ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cost_mast (
    ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    weav_dsn_no INTEGER REFERENCES warp_sheet(ref_no),
    tot_cost NUMERIC(18,2) DEFAULT 0,
    n_qty NUMERIC(18,2) DEFAULT 0,
    sing_cost NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cost_mast ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cost_child (
    ref_no SERIAL PRIMARY KEY,
    cm_ref_no INTEGER REFERENCES cost_mast(ref_no) ON DELETE CASCADE,
    item VARCHAR(150),
    units VARCHAR(20),
    qty NUMERIC(18,3) DEFAULT 0,
    rate NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cost_child ENABLE ROW LEVEL SECURITY;
-- 008_tax_compliance.sql

CREATE TABLE IF NOT EXISTS itc_mast (
    ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    reg_code INTEGER DEFAULT 50,
    tax_model VARCHAR(50),
    rev_chrg VARCHAR(10) DEFAULT 'No',
    itc_status VARCHAR(50) DEFAULT 'Pending',
    inv_type VARCHAR(50),
    cr_code INTEGER REFERENCES ledger(ledg_code),
    dr_code INTEGER REFERENCES ledger(ledg_code),
    bill_char VARCHAR(10),
    bill_ref_no VARCHAR(50),
    bill_date TIMESTAMPTZ,
    entry_date TIMESTAMPTZ DEFAULT NOW(),
    dr_narr VARCHAR(500), cr_narr VARCHAR(500),
    tot_qty NUMERIC(18,2) DEFAULT 0,
    grd_tot NUMERIC(18,2) DEFAULT 0,
    add_less_exp1 VARCHAR(100),
    add_exp1_amt NUMERIC(18,2) DEFAULT 0,
    amt_type VARCHAR(50),
    add_exp2_code INTEGER,
    add_less_exp2 VARCHAR(100),
    add_exp2_amt NUMERIC(18,2) DEFAULT 0,
    bf_gst_amt NUMERIC(18,2) DEFAULT 0,
    igst_code INTEGER, igst_perc NUMERIC(18,2) DEFAULT 0, igst_amt NUMERIC(18,2) DEFAULT 0,
    cgst_code INTEGER, cgst_perc NUMERIC(18,2) DEFAULT 0, cgst_amt NUMERIC(18,2) DEFAULT 0,
    sgst_code INTEGER, sgst_perc NUMERIC(18,2) DEFAULT 0, sgst_amt NUMERIC(18,2) DEFAULT 0,
    rnd_off NUMERIC(18,2) DEFAULT 0,
    net_total NUMERIC(18,2) DEFAULT 0,
    gst_status VARCHAR(50) DEFAULT 'Not Filed',
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE itc_mast ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS itc_child (
    ref_no SERIAL PRIMARY KEY,
    itc_ref_no INTEGER REFERENCES itc_mast(ref_no) ON DELETE CASCADE,
    itm_code INTEGER REFERENCES sac_tax_setup(ref_no),
    qty NUMERIC(18,2) DEFAULT 0,
    rate NUMERIC(18,2) DEFAULT 0,
    disc_perc NUMERIC(18,2) DEFAULT 0, disc_amt NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    igst_perc NUMERIC(18,2) DEFAULT 0, igst_amnt NUMERIC(18,2) DEFAULT 0,
    cgst_perc NUMERIC(18,2) DEFAULT 0, cgst_amnt NUMERIC(18,2) DEFAULT 0,
    sgst_perc NUMERIC(18,2) DEFAULT 0, sgst_amnt NUMERIC(18,2) DEFAULT 0,
    net_tot NUMERIC(18,2) DEFAULT 0,
    frm_code INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE itc_child ENABLE ROW LEVEL SECURITY;
-- 009_stock_verification.sql

CREATE TABLE IF NOT EXISTS ps_stock_master (
    ps_ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    details VARCHAR(250),
    frm_no INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ps_stock_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ps_stock_child (
    ps_id SERIAL PRIMARY KEY,
    ps_ref_no INTEGER REFERENCES ps_stock_master(ps_ref_no) ON DELETE CASCADE,
    rec_no INTEGER,
    prd_code INTEGER REFERENCES product(ref_no),
    bar_ref_id INTEGER,
    supp_code INTEGER,
    tag_rate NUMERIC(18,2) DEFAULT 0,
    frm_no INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ps_stock_child ENABLE ROW LEVEL SECURITY;
-- 010_views_functions.sql

CREATE OR REPLACE VIEW qry_receivable AS
SELECT 
    w.whl_ref_no, 
    w.bill_ref_no, 
    w.bill_date, 
    w.dr_code, 
    w.net_total, 
    COALESCE(b.rate_diff, 0) as rate_diff,
    COALESCE(r.sales_ret, 0) as sales_ret,
    COALESCE(b.disc_amt, 0) as disc_amt,
    COALESCE(b.adj_amt, 0) as paid_amt,
    (w.net_total - COALESCE(b.rate_diff,0) - COALESCE(r.sales_ret,0) - COALESCE(b.disc_amt,0) - COALESCE(b.adj_amt,0)) as balance
FROM wholesale_mast w
LEFT JOIN (
    SELECT ref_bill_no, SUM(adj_amt) as adj_amt, SUM(rate_diff) as rate_diff, SUM(disc_amt) as disc_amt
    FROM bill_adjustment
    GROUP BY ref_bill_no
) b ON w.bill_ref_no = b.ref_bill_no
LEFT JOIN (
    SELECT bill_ref_no, SUM(net_total) as sales_ret
    FROM wholesale_ret_mast
    GROUP BY bill_ref_no
) r ON w.bill_ref_no = r.bill_ref_no;

CREATE OR REPLACE VIEW qry_payable AS
SELECT 
    p.pm_ref_no, 
    p.pm_bill_ref_no, 
    p.pm_bill_date, 
    p.pm_cr_code, 
    p.pm_net_total,
    COALESCE(b.adj_amt, 0) as paid_amt,
    (p.pm_net_total - COALESCE(b.adj_amt,0)) as balance
FROM pur_mast p
LEFT JOIN (
    SELECT ref_bill_no, SUM(adj_amt) as adj_amt
    FROM bill_adjustment
    GROUP BY ref_bill_no
) b ON p.pm_bill_ref_no = b.ref_bill_no;

CREATE OR REPLACE FUNCTION fn_next_voucher_no(p_table TEXT, p_column TEXT, p_frm_code INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_next_no INTEGER;
    v_sql TEXT;
BEGIN
    v_sql := format('SELECT COALESCE(MAX(%I), 0) + 1 FROM %I WHERE frm_code = $1', p_column, p_table);
    EXECUTE v_sql INTO v_next_no USING p_frm_code;
    RETURN v_next_no;
EXCEPTION
    WHEN undefined_column THEN
        v_sql := format('SELECT COALESCE(MAX(%I), 0) + 1 FROM %I', p_column, p_table);
        EXECUTE v_sql INTO v_next_no;
        RETURN v_next_no;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_ledger_balance(p_ledg_code INTEGER, p_amount NUMERIC, p_type TEXT)
RETURNS VOID AS $$
BEGIN
    IF p_type = 'Dr' THEN
        UPDATE ledger 
        SET bal_amt = bal_amt + p_amount, 
            bal_type = CASE WHEN bal_amt + p_amount >= 0 THEN 'Dr' ELSE 'Cr' END,
            bal_amt = ABS(bal_amt + p_amount)
        WHERE ledg_code = p_ledg_code;
    ELSIF p_type = 'Cr' THEN
        UPDATE ledger 
        SET bal_amt = bal_amt - p_amount, 
            bal_type = CASE WHEN bal_amt - p_amount <= 0 THEN 'Cr' ELSE 'Dr' END,
            bal_amt = ABS(bal_amt - p_amount)
        WHERE ledg_code = p_ledg_code;
    END IF;
END;
$$ LANGUAGE plpgsql;
-- 011_rls_policies.sql
-- Disables RLS on application tables to allow custom application authentication & REST API access

ALTER TABLE company DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_setting DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_log_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE session DISABLE ROW LEVEL SECURITY;
ALTER TABLE amount_setup DISABLE ROW LEVEL SECURITY;

ALTER TABLE group_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE sub_group DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledg_opp_balance DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE contra_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE contra_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE debit_note_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE debit_note_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE bill_adjustment DISABLE ROW LEVEL SECURITY;

ALTER TABLE units_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_group DISABLE ROW LEVEL SECURITY;
ALTER TABLE product DISABLE ROW LEVEL SECURITY;
ALTER TABLE colour_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE design DISABLE ROW LEVEL SECURITY;
ALTER TABLE warp_type DISABLE ROW LEVEL SECURITY;
ALTER TABLE weft_type DISABLE ROW LEVEL SECURITY;
ALTER TABLE warp_sheet DISABLE ROW LEVEL SECURITY;
ALTER TABLE bar_temp DISABLE ROW LEVEL SECURITY;
ALTER TABLE prod_opp_bal DISABLE ROW LEVEL SECURITY;
ALTER TABLE yarn_opp DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_journal DISABLE ROW LEVEL SECURITY;

ALTER TABLE tax_reg DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_setup DISABLE ROW LEVEL SECURITY;
ALTER TABLE prod_tax_setup DISABLE ROW LEVEL SECURITY;
ALTER TABLE sac_tax_setup DISABLE ROW LEVEL SECURITY;
ALTER TABLE pur_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE pur_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE pur_ret_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE pur_ret_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE inward DISABLE ROW LEVEL SECURITY;

ALTER TABLE estimate_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sale_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sale_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sale_ret_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sale_ret_child DISABLE ROW LEVEL SECURITY;

ALTER TABLE del_chall_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE del_chall_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_ret_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_ret_child DISABLE ROW LEVEL SECURITY;

ALTER TABLE lot_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE twist_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE twist_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE twist_recd_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE twist_recd_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE dyeing_issue_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE dyeing_issue_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE dyeing_recd_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE dyeing_recd_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE loom DISABLE ROW LEVEL SECURITY;
ALTER TABLE weav_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE weaving_trans DISABLE ROW LEVEL SECURITY;
ALTER TABLE weaver_pay_setting DISABLE ROW LEVEL SECURITY;
ALTER TABLE weav_pay_confirm DISABLE ROW LEVEL SECURITY;
ALTER TABLE cost_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE cost_child DISABLE ROW LEVEL SECURITY;

ALTER TABLE itc_mast DISABLE ROW LEVEL SECURITY;
ALTER TABLE itc_child DISABLE ROW LEVEL SECURITY;
ALTER TABLE ps_stock_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE ps_stock_child DISABLE ROW LEVEL SECURITY;

-- Ensure default admin user exists
INSERT INTO admin (user_name, user_password, user_type, user_status) 
VALUES ('admin', 'admin123', 'Administrator', 'Active')
ON CONFLICT (user_name) DO UPDATE 
SET user_password = 'admin123', user_status = 'Active';
