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
