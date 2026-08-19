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
