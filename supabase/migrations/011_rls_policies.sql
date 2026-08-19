-- 011_rls_policies.sql
-- Enables public read/write access policies for all application tables

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'company', 'app_setting', 'admin', 'user_permission', 'user_log_info', 'session', 'amount_setup',
        'group_master', 'sub_group', 'ledger', 'ledg_opp_balance', 'receipt_master', 'receipt_child', 
        'payment_master', 'payment_child', 'journal_master', 'journal_child', 'contra_master', 'contra_child', 
        'credit_note_master', 'credit_note_child', 'debit_note_master', 'debit_note_child', 'bill_adjustment',
        'units_master', 'product_group', 'product', 'colour_info', 'design', 'warp_type', 'weft_type', 
        'warp_sheet', 'bar_temp', 'prod_opp_bal', 'yarn_opp', 'stock_journal',
        'tax_reg', 'tax_setup', 'prod_tax_setup', 'sac_tax_setup', 'pur_mast', 'pur_child', 
        'pur_ret_mast', 'pur_ret_child', 'inward',
        'estimate_mast', 'estimate_child', 'retail_sale_mast', 'retail_sale_child', 
        'retail_sale_ret_mast', 'retail_sale_ret_child',
        'del_chall_mast', 'del_chall_child', 'wholesale_mast', 'wholesale_child', 
        'wholesale_ret_mast', 'wholesale_ret_child',
        'lot_info', 'twist_master', 'twist_child', 'twist_recd_master', 'twist_recd_child', 
        'dyeing_issue_master', 'dyeing_issue_child', 'dyeing_recd_master', 'dyeing_recd_child', 
        'loom', 'weav_master', 'weaving_trans', 'weaver_pay_setting', 'weav_pay_confirm', 
        'cost_mast', 'cost_child', 'itc_mast', 'itc_child', 'ps_stock_master', 'ps_stock_child'
    ];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public access policy" ON %I;', t);
        EXECUTE format('CREATE POLICY "Public access policy" ON %I FOR ALL USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;
