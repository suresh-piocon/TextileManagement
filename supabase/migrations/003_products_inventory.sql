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
DROP TRIGGER IF EXISTS update_product_group_modtime ON product_group;
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
DROP TRIGGER IF EXISTS update_product_modtime ON product;
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
DROP TRIGGER IF EXISTS update_warp_sheet_modtime ON warp_sheet;
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
