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
DROP TRIGGER IF EXISTS update_company_modtime ON company;
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
DROP TRIGGER IF EXISTS update_app_setting_modtime ON app_setting;
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
DROP TRIGGER IF EXISTS update_admin_modtime ON admin;
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
