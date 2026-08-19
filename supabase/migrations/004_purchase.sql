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
