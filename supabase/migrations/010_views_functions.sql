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
