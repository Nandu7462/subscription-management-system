--
-- PostgreSQL database dump
--

\restrict BkIfeV5ZTLkRQADfDZzuhyY2CBOjdamM0rHFDn37ZhDY34h3JPDFcVTlVL2mbEj

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    actor_id character varying(36),
    action character varying(100) NOT NULL,
    entity_id character varying(36) NOT NULL,
    details json NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: billing_job_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_job_logs (
    subscription_id character varying(36) NOT NULL,
    success boolean NOT NULL,
    message text NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    user_id character varying(36) NOT NULL,
    business_name character varying(200) NOT NULL,
    billing_address text NOT NULL,
    tax_number character varying(100) NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: discount_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_redemptions (
    discount_id character varying(36) NOT NULL,
    invoice_id character varying(36) NOT NULL,
    amount numeric(14,2) NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: discount_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_rules (
    name character varying(200) NOT NULL,
    type character varying(16) NOT NULL,
    value numeric(14,2) NOT NULL,
    min_purchase numeric(14,2) NOT NULL,
    min_quantity integer NOT NULL,
    start_date date,
    end_date date,
    usage_limit integer,
    usage_count integer NOT NULL,
    product_id character varying(36),
    subscription_id character varying(36),
    is_active boolean NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_discount_rules_amounts CHECK (((value >= (0)::numeric) AND (min_purchase >= (0)::numeric) AND (min_quantity > 0))),
    CONSTRAINT ck_discount_rules_type_value CHECK ((((type)::text = ANY ((ARRAY['fixed'::character varying, 'percentage'::character varying])::text[])) AND (((type)::text <> 'percentage'::text) OR (value <= (100)::numeric)))),
    CONSTRAINT ck_discount_rules_usage CHECK (((usage_count >= 0) AND ((usage_limit IS NULL) OR (usage_count <= usage_limit))))
);


--
-- Name: invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_lines (
    invoice_id character varying(36) NOT NULL,
    product_id character varying(36),
    description character varying(300) NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    tax_rate numeric(7,4) NOT NULL,
    discount_amount numeric(14,2) NOT NULL,
    tax_amount numeric(14,2) NOT NULL,
    line_total numeric(14,2) NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    number character varying(50) NOT NULL,
    subscription_id character varying(36) NOT NULL,
    customer_id character varying(36) NOT NULL,
    billing_period date NOT NULL,
    period_end date NOT NULL,
    due_date date NOT NULL,
    subtotal numeric(14,2) NOT NULL,
    tax numeric(14,2) NOT NULL,
    discount numeric(14,2) NOT NULL,
    total numeric(14,2) NOT NULL,
    amount_paid numeric(14,2) NOT NULL,
    status character varying(20) NOT NULL,
    billing_name character varying(200) NOT NULL,
    billing_address text NOT NULL,
    tax_number character varying(100) NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_invoices_amounts CHECK (((total >= (0)::numeric) AND (amount_paid >= (0)::numeric) AND (amount_paid <= total))),
    CONSTRAINT ck_invoices_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'confirmed'::character varying, 'partially_paid'::character varying, 'paid'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    user_id character varying(36) NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    invoice_id character varying(36) NOT NULL,
    method character varying(30) NOT NULL,
    amount numeric(14,2) NOT NULL,
    payment_date date NOT NULL,
    notes text NOT NULL,
    recorded_by character varying(36) NOT NULL,
    idempotency_key character varying(100) NOT NULL,
    reversed_at timestamp with time zone,
    reversal_reason text,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_payments_amount CHECK ((amount > (0)::numeric))
);


--
-- Name: plan_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_products (
    plan_id character varying(36) NOT NULL,
    product_id character varying(36) NOT NULL,
    default_quantity integer NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_plan_products_quantity CHECK ((default_quantity > 0))
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    name character varying(200) NOT NULL,
    price numeric(14,2) NOT NULL,
    billing_interval character varying(16) NOT NULL,
    minimum_quantity integer NOT NULL,
    available_from date,
    available_until date,
    auto_close boolean NOT NULL,
    allow_pause boolean NOT NULL,
    allow_early_close boolean NOT NULL,
    allow_renewal boolean NOT NULL,
    is_active boolean NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_plans_amounts CHECK (((price >= (0)::numeric) AND (minimum_quantity > 0))),
    CONSTRAINT ck_plans_interval CHECK (((billing_interval)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'yearly'::character varying])::text[])))
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    product_id character varying(36) NOT NULL,
    attribute_name character varying(100) NOT NULL,
    attribute_value character varying(100) NOT NULL,
    price_extra numeric(14,2) NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_product_variants_extra CHECK ((price_extra >= (0)::numeric))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    name character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    sales_price numeric(14,2) NOT NULL,
    cost_price numeric(14,2) NOT NULL,
    notes text NOT NULL,
    is_active boolean NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_products_prices CHECK (((sales_price >= (0)::numeric) AND (cost_price >= (0)::numeric)))
);


--
-- Name: quotation_template_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotation_template_lines (
    template_id character varying(36) NOT NULL,
    product_id character varying(36) NOT NULL,
    variant_id character varying(36),
    quantity integer NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    tax_rule_id character varying(36),
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: quotation_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotation_templates (
    name character varying(200) NOT NULL,
    plan_id character varying(36) NOT NULL,
    validity_days integer NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: subscription_discounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_discounts (
    subscription_id character varying(36) NOT NULL,
    discount_id character varying(36) NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: subscription_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_lines (
    subscription_id character varying(36) NOT NULL,
    product_id character varying(36) NOT NULL,
    variant_id character varying(36),
    description character varying(300) NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    tax_rule_id character varying(36),
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_subscription_lines_amounts CHECK (((quantity > 0) AND (unit_price >= (0)::numeric)))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    number character varying(50) NOT NULL,
    customer_id character varying(36) NOT NULL,
    plan_id character varying(36) NOT NULL,
    status character varying(20) NOT NULL,
    start_date date NOT NULL,
    expiry_date date,
    next_billing_date date NOT NULL,
    billing_anchor date NOT NULL,
    billing_cycle integer NOT NULL,
    billing_interval character varying(16) NOT NULL,
    plan_fee numeric(14,2) NOT NULL,
    payment_terms integer NOT NULL,
    quotation_valid_until date,
    quotation_validity_days integer NOT NULL,
    paused_at date,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_subscriptions_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'quotation'::character varying, 'confirmed'::character varying, 'active'::character varying, 'paused'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: tax_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_rules (
    name character varying(200) NOT NULL,
    rate numeric(7,4) NOT NULL,
    start_date date,
    end_date date,
    is_active boolean NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_tax_rules_rate CHECK (((rate >= (0)::numeric) AND (rate <= (100)::numeric)))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    email character varying(254) NOT NULL,
    password_hash text NOT NULL,
    role character varying(16) NOT NULL,
    is_active boolean NOT NULL,
    token_version integer NOT NULL,
    id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_users_role CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'staff'::character varying, 'customer'::character varying])::text[])))
);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: audit_logs pk_audit_logs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT pk_audit_logs PRIMARY KEY (id);


--
-- Name: billing_job_logs pk_billing_job_logs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_job_logs
    ADD CONSTRAINT pk_billing_job_logs PRIMARY KEY (id);


--
-- Name: customers pk_customers; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT pk_customers PRIMARY KEY (id);


--
-- Name: discount_redemptions pk_discount_redemptions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_redemptions
    ADD CONSTRAINT pk_discount_redemptions PRIMARY KEY (id);


--
-- Name: discount_rules pk_discount_rules; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_rules
    ADD CONSTRAINT pk_discount_rules PRIMARY KEY (id);


--
-- Name: invoice_lines pk_invoice_lines; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT pk_invoice_lines PRIMARY KEY (id);


--
-- Name: invoices pk_invoices; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT pk_invoices PRIMARY KEY (id);


--
-- Name: password_reset_tokens pk_password_reset_tokens; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT pk_password_reset_tokens PRIMARY KEY (id);


--
-- Name: payments pk_payments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT pk_payments PRIMARY KEY (id);


--
-- Name: plan_products pk_plan_products; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_products
    ADD CONSTRAINT pk_plan_products PRIMARY KEY (id);


--
-- Name: plans pk_plans; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT pk_plans PRIMARY KEY (id);


--
-- Name: product_variants pk_product_variants; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT pk_product_variants PRIMARY KEY (id);


--
-- Name: products pk_products; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT pk_products PRIMARY KEY (id);


--
-- Name: quotation_template_lines pk_quotation_template_lines; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_template_lines
    ADD CONSTRAINT pk_quotation_template_lines PRIMARY KEY (id);


--
-- Name: quotation_templates pk_quotation_templates; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_templates
    ADD CONSTRAINT pk_quotation_templates PRIMARY KEY (id);


--
-- Name: subscription_discounts pk_subscription_discounts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_discounts
    ADD CONSTRAINT pk_subscription_discounts PRIMARY KEY (id);


--
-- Name: subscription_lines pk_subscription_lines; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_lines
    ADD CONSTRAINT pk_subscription_lines PRIMARY KEY (id);


--
-- Name: subscriptions pk_subscriptions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT pk_subscriptions PRIMARY KEY (id);


--
-- Name: tax_rules pk_tax_rules; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT pk_tax_rules PRIMARY KEY (id);


--
-- Name: users pk_users; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users PRIMARY KEY (id);


--
-- Name: customers uq_customers_user_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT uq_customers_user_id UNIQUE (user_id);


--
-- Name: discount_redemptions uq_discount_redemptions_discount_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_redemptions
    ADD CONSTRAINT uq_discount_redemptions_discount_id UNIQUE (discount_id, invoice_id);


--
-- Name: invoices uq_invoice_billing_cycle; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT uq_invoice_billing_cycle UNIQUE (subscription_id, billing_period);


--
-- Name: invoices uq_invoices_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT uq_invoices_number UNIQUE (number);


--
-- Name: password_reset_tokens uq_password_reset_tokens_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT uq_password_reset_tokens_token_hash UNIQUE (token_hash);


--
-- Name: payments uq_payments_idempotency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT uq_payments_idempotency_key UNIQUE (idempotency_key);


--
-- Name: plan_products uq_plan_products_plan_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_products
    ADD CONSTRAINT uq_plan_products_plan_id UNIQUE (plan_id, product_id);


--
-- Name: product_variants uq_product_variants_product_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT uq_product_variants_product_id UNIQUE (product_id, attribute_name, attribute_value);


--
-- Name: subscription_discounts uq_subscription_discounts_subscription_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_discounts
    ADD CONSTRAINT uq_subscription_discounts_subscription_id UNIQUE (subscription_id, discount_id);


--
-- Name: subscriptions uq_subscriptions_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT uq_subscriptions_number UNIQUE (number);


--
-- Name: users uq_users_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_email UNIQUE (email);


--
-- Name: idx_invoices_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_due ON public.invoices USING btree (status, due_date);


--
-- Name: idx_subscriptions_billing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_billing ON public.subscriptions USING btree (status, next_billing_date);


--
-- Name: ix_audit_logs_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_entity_id ON public.audit_logs USING btree (entity_id);


--
-- Name: ix_invoice_lines_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_invoice_lines_invoice_id ON public.invoice_lines USING btree (invoice_id);


--
-- Name: ix_invoices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_invoices_customer_id ON public.invoices USING btree (customer_id);


--
-- Name: ix_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: ix_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payments_invoice_id ON public.payments USING btree (invoice_id);


--
-- Name: ix_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payments_payment_date ON public.payments USING btree (payment_date);


--
-- Name: ix_plan_products_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_plan_products_plan_id ON public.plan_products USING btree (plan_id);


--
-- Name: ix_product_variants_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_variants_product_id ON public.product_variants USING btree (product_id);


--
-- Name: ix_quotation_template_lines_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_quotation_template_lines_template_id ON public.quotation_template_lines USING btree (template_id);


--
-- Name: ix_subscription_discounts_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subscription_discounts_subscription_id ON public.subscription_discounts USING btree (subscription_id);


--
-- Name: ix_subscription_lines_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subscription_lines_subscription_id ON public.subscription_lines USING btree (subscription_id);


--
-- Name: ix_subscriptions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subscriptions_customer_id ON public.subscriptions USING btree (customer_id);


--
-- Name: uq_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_email_lower ON public.users USING btree (lower((email)::text));


--
-- Name: audit_logs fk_audit_logs_actor_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT fk_audit_logs_actor_id_users FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: billing_job_logs fk_billing_job_logs_subscription_id_subscriptions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_job_logs
    ADD CONSTRAINT fk_billing_job_logs_subscription_id_subscriptions FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: customers fk_customers_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_customers_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: discount_redemptions fk_discount_redemptions_discount_id_discount_rules; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_redemptions
    ADD CONSTRAINT fk_discount_redemptions_discount_id_discount_rules FOREIGN KEY (discount_id) REFERENCES public.discount_rules(id);


--
-- Name: discount_redemptions fk_discount_redemptions_invoice_id_invoices; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_redemptions
    ADD CONSTRAINT fk_discount_redemptions_invoice_id_invoices FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: discount_rules fk_discount_rules_product_id_products; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_rules
    ADD CONSTRAINT fk_discount_rules_product_id_products FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: discount_rules fk_discount_subscription; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_rules
    ADD CONSTRAINT fk_discount_subscription FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: invoice_lines fk_invoice_lines_invoice_id_invoices; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT fk_invoice_lines_invoice_id_invoices FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: invoice_lines fk_invoice_lines_product_id_products; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT fk_invoice_lines_product_id_products FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: invoices fk_invoices_customer_id_customers; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoices_customer_id_customers FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices fk_invoices_subscription_id_subscriptions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoices_subscription_id_subscriptions FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: password_reset_tokens fk_password_reset_tokens_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT fk_password_reset_tokens_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payments fk_payments_invoice_id_invoices; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_payments_invoice_id_invoices FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payments fk_payments_recorded_by_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_payments_recorded_by_users FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: plan_products fk_plan_products_plan_id_plans; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_products
    ADD CONSTRAINT fk_plan_products_plan_id_plans FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: plan_products fk_plan_products_product_id_products; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_products
    ADD CONSTRAINT fk_plan_products_product_id_products FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: product_variants fk_product_variants_product_id_products; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT fk_product_variants_product_id_products FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: quotation_template_lines fk_quotation_template_lines_product_id_products; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_template_lines
    ADD CONSTRAINT fk_quotation_template_lines_product_id_products FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: quotation_template_lines fk_quotation_template_lines_tax_rule_id_tax_rules; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_template_lines
    ADD CONSTRAINT fk_quotation_template_lines_tax_rule_id_tax_rules FOREIGN KEY (tax_rule_id) REFERENCES public.tax_rules(id);


--
-- Name: quotation_template_lines fk_quotation_template_lines_template_id_quotation_templates; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_template_lines
    ADD CONSTRAINT fk_quotation_template_lines_template_id_quotation_templates FOREIGN KEY (template_id) REFERENCES public.quotation_templates(id);


--
-- Name: quotation_template_lines fk_quotation_template_lines_variant_id_product_variants; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_template_lines
    ADD CONSTRAINT fk_quotation_template_lines_variant_id_product_variants FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: quotation_templates fk_quotation_templates_plan_id_plans; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_templates
    ADD CONSTRAINT fk_quotation_templates_plan_id_plans FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: subscription_discounts fk_subscription_discounts_discount_id_discount_rules; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_discounts
    ADD CONSTRAINT fk_subscription_discounts_discount_id_discount_rules FOREIGN KEY (discount_id) REFERENCES public.discount_rules(id);


--
-- Name: subscription_discounts fk_subscription_discounts_subscription_id_subscriptions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_discounts
    ADD CONSTRAINT fk_subscription_discounts_subscription_id_subscriptions FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: subscription_lines fk_subscription_lines_product_id_products; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_lines
    ADD CONSTRAINT fk_subscription_lines_product_id_products FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: subscription_lines fk_subscription_lines_subscription_id_subscriptions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_lines
    ADD CONSTRAINT fk_subscription_lines_subscription_id_subscriptions FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: subscription_lines fk_subscription_lines_tax_rule_id_tax_rules; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_lines
    ADD CONSTRAINT fk_subscription_lines_tax_rule_id_tax_rules FOREIGN KEY (tax_rule_id) REFERENCES public.tax_rules(id);


--
-- Name: subscription_lines fk_subscription_lines_variant_id_product_variants; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_lines
    ADD CONSTRAINT fk_subscription_lines_variant_id_product_variants FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: subscriptions fk_subscriptions_customer_id_customers; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT fk_subscriptions_customer_id_customers FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: subscriptions fk_subscriptions_plan_id_plans; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT fk_subscriptions_plan_id_plans FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- PostgreSQL database dump complete
--

\unrestrict BkIfeV5ZTLkRQADfDZzuhyY2CBOjdamM0rHFDn37ZhDY34h3JPDFcVTlVL2mbEj

