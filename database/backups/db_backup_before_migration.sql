--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: permisos_admin
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO permisos_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: permisos_admin
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO permisos_admin;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: permisos_admin
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO permisos_admin;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: permisos_admin
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: payment_verification_log; Type: TABLE; Schema: public; Owner: permisos_admin
--

CREATE TABLE public.payment_verification_log (
    id integer NOT NULL,
    application_id integer NOT NULL,
    verified_by integer NOT NULL,
    action character varying(50) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.payment_verification_log OWNER TO permisos_admin;

--
-- Name: payment_verification_log_id_seq; Type: SEQUENCE; Schema: public; Owner: permisos_admin
--

CREATE SEQUENCE public.payment_verification_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_verification_log_id_seq OWNER TO permisos_admin;

--
-- Name: payment_verification_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: permisos_admin
--

ALTER SEQUENCE public.payment_verification_log_id_seq OWNED BY public.payment_verification_log.id;


--
-- Name: permit_applications; Type: TABLE; Schema: public; Owner: permisos_admin
--

CREATE TABLE public.permit_applications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    status character varying(50) DEFAULT 'PENDING_PAYMENT'::character varying NOT NULL,
    payment_processor_order_id character varying(255),
    permit_file_path character varying(512),
    recibo_file_path text,
    certificado_file_path text,
    nombre_completo character varying(255) NOT NULL,
    curp_rfc character varying(50) NOT NULL,
    domicilio text NOT NULL,
    marca character varying(100) NOT NULL,
    linea character varying(100) NOT NULL,
    color character varying(100) NOT NULL,
    numero_serie character varying(50) NOT NULL,
    numero_motor character varying(50) NOT NULL,
    ano_modelo character varying(20) NOT NULL,
    folio character varying(50),
    importe numeric(10,2),
    fecha_expedicion date,
    fecha_vencimiento date,
    payment_proof_path character varying(512),
    payment_proof_uploaded_at timestamp with time zone,
    payment_notes text,
    payment_verified_by integer,
    payment_verified_at timestamp with time zone,
    payment_rejection_reason text,
    payment_reference character varying(100),
    renewed_from_id integer,
    renewal_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.permit_applications OWNER TO permisos_admin;

--
-- Name: permit_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: permisos_admin
--

CREATE SEQUENCE public.permit_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permit_applications_id_seq OWNER TO permisos_admin;

--
-- Name: permit_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: permisos_admin
--

ALTER SEQUENCE public.permit_applications_id_seq OWNED BY public.permit_applications.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: permisos_admin
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    version character varying(255) NOT NULL,
    description text,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO permisos_admin;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: permisos_admin
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schema_migrations_id_seq OWNER TO permisos_admin;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: permisos_admin
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: security_audit_log; Type: TABLE; Schema: public; Owner: permisos_admin
--

CREATE TABLE public.security_audit_log (
    id integer NOT NULL,
    user_id integer,
    action_type character varying(100) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    details jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.security_audit_log OWNER TO permisos_admin;

--
-- Name: security_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: permisos_admin
--

CREATE SEQUENCE public.security_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_audit_log_id_seq OWNER TO permisos_admin;

--
-- Name: security_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: permisos_admin
--

ALTER SEQUENCE public.security_audit_log_id_seq OWNED BY public.security_audit_log.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: permisos_admin
--

CREATE TABLE public.user_sessions (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO permisos_admin;

--
-- Name: users; Type: TABLE; Schema: public; Owner: permisos_admin
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    role character varying(50) DEFAULT 'client'::character varying NOT NULL,
    account_type character varying(50) DEFAULT 'client'::character varying NOT NULL,
    created_by integer,
    is_admin_portal boolean DEFAULT false NOT NULL,
    account_created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.users OWNER TO permisos_admin;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: permisos_admin
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO permisos_admin;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: permisos_admin
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: payment_verification_log id; Type: DEFAULT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.payment_verification_log ALTER COLUMN id SET DEFAULT nextval('public.payment_verification_log_id_seq'::regclass);


--
-- Name: permit_applications id; Type: DEFAULT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.permit_applications ALTER COLUMN id SET DEFAULT nextval('public.permit_applications_id_seq'::regclass);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: security_audit_log id; Type: DEFAULT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.security_audit_log ALTER COLUMN id SET DEFAULT nextval('public.security_audit_log_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: permisos_admin
--

COPY public.password_reset_tokens (id, user_id, token, expires_at, used, created_at) FROM stdin;
\.


--
-- Data for Name: payment_verification_log; Type: TABLE DATA; Schema: public; Owner: permisos_admin
--

COPY public.payment_verification_log (id, application_id, verified_by, action, notes, created_at) FROM stdin;
1	1	1	approved	Payment verified through bank transfer reference	2025-04-06 10:56:14.795008-07
2	8	1	approved	Payment verified successfully	2025-04-20 13:35:21.893206-07
3	9	1	rejected	Invalid payment proof: The payment proof is not clear. Please upload a clearer image.	2025-04-20 13:35:32.395999-07
\.


--
-- Data for Name: permit_applications; Type: TABLE DATA; Schema: public; Owner: permisos_admin
--

COPY public.permit_applications (id, user_id, status, payment_processor_order_id, permit_file_path, recibo_file_path, certificado_file_path, nombre_completo, curp_rfc, domicilio, marca, linea, color, numero_serie, numero_motor, ano_modelo, folio, importe, fecha_expedicion, fecha_vencimiento, payment_proof_path, payment_proof_uploaded_at, payment_notes, payment_verified_by, payment_verified_at, payment_rejection_reason, payment_reference, renewed_from_id, renewal_count, created_at, updated_at) FROM stdin;
1	3	PERMIT_READY	\N	\N	\N	\N	Carlos LÃ³pez GarcÃ­a	LOGC850612HDFRRL09	Calle Insurgentes Sur 1234, Col. Del Valle, Ciudad de MÃ©xico, CP 03100	Volkswagen	Jetta	Blanco	VWD123456789ABC123	ABA123456	2020	PDG-2023-00001	1350.00	2023-12-01	2024-12-01	/storage/uploads/payment_proofs/carlos_lopez_receipt.pdf	2025-04-05 10:56:14.784464-07	\N	1	2025-04-06 10:56:14.784464-07	\N	REF-123456	\N	0	2025-04-20 10:56:14.784464-07	2025-04-20 10:56:14.784464-07
2	3	PENDING_PAYMENT	\N	\N	\N	\N	Carlos LÃ³pez GarcÃ­a	LOGC850612HDFRRL09	Calle Insurgentes Sur 1234, Col. Del Valle, Ciudad de MÃ©xico, CP 03100	Honda	CR-V	Azul	HON987654321XYZ987	HND456789	2022	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2025-04-20 10:56:14.794074-07	2025-04-20 10:56:14.794074-07
3	9	PENDING_PAYMENT	\N	\N	\N	\N	Test User	TEST123456HDFXXX01	123 Test Street, Test City	Toyota	Corolla	Blue	1HGCM82633A123456	ABC123456	2023	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2025-04-20 12:37:18.301773-07	2025-04-20 12:37:18.301773-07
4	10	PENDING_PAYMENT	\N	\N	\N	\N	Test User	TEST123456HDFXXX01	123 Test Street, Test City	Toyota	Corolla	Blue	1HGCM82633A123456	ABC123456	2023	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2025-04-20 12:37:38.03967-07	2025-04-20 12:37:38.03967-07
5	11	PENDING_PAYMENT	\N	\N	\N	\N	Test User	TEST123456HDFXXX01	123 Test Street, Test City	Toyota	Corolla	Blue	1HGCM82633A123456	ABC123456	2023	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2025-04-20 12:38:39.638778-07	2025-04-20 12:38:39.638778-07
6	21	PENDING_PAYMENT	\N	\N	\N	\N	Test User	TESU123456HDFXXX01	456 Updated Street, Test City	Toyota	Corolla	Red	1HGCM82633A123456	ABC123456	2022	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2025-04-20 13:24:31.844469-07	2025-04-20 13:24:50.063315-07
7	21	PENDING_PAYMENT	\N	\N	\N	\N	Test Admin User	TESU123456HDFXXX02	123 Admin Test Street, Test City	Ford	Mustang	Black	1HGCM82633A654321	XYZ654321	2023	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2025-04-20 13:29:43.666181-07	2025-04-20 13:29:43.666181-07
8	21	GENERATING_PERMIT	\N	\N	\N	\N	Test Approval User	TESU123456HDFXXX03	123 Approval Street, Test City	Honda	Civic	Blue	1HGCM82633A111111	ABC111111	2023	\N	\N	\N	\N	storage/payment_proofs/app8_proof.jpg	2025-04-20 13:34:35.812858-07	Payment verified successfully	1	2025-04-20 13:35:21.893206-07	\N	REF-APP-8	\N	0	2025-04-20 13:34:09.697011-07	2025-04-20 13:35:21.918153-07
9	21	PROOF_REJECTED	\N	\N	\N	\N	Test Rejection User	TESU123456HDFXXX04	123 Rejection Street, Test City	Toyota	Camry	Red	1HGCM82633A222222	ABC222222	2023	\N	\N	\N	\N	storage/payment_proofs/app9_proof.jpg	2025-04-20 13:34:35.821828-07	\N	\N	\N	Invalid payment proof: The payment proof is not clear. Please upload a clearer image.	REF-APP-9	\N	0	2025-04-20 13:34:22.809629-07	2025-04-20 13:35:32.395999-07
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: permisos_admin
--

COPY public.schema_migrations (id, version, description, applied_at) FROM stdin;
1	001	initial schema	2025-04-20 10:56:35.129884-07
\.


--
-- Data for Name: security_audit_log; Type: TABLE DATA; Schema: public; Owner: permisos_admin
--

COPY public.security_audit_log (id, user_id, action_type, ip_address, user_agent, details, created_at) FROM stdin;
1	1	login	192.168.1.100	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36	{"device": "desktop", "location": "Ciudad de MÃ©xico"}	2025-04-18 10:56:14.797943-07
2	3	login	187.190.154.123	Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1	{"device": "mobile", "location": "Guadalajara"}	2025-04-19 10:56:14.800832-07
3	1	admin_action	192.168.1.100	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36	{"action": "verify_payment", "application_id": 1}	2025-04-06 10:56:14.801963-07
4	3	failed_login	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"email": "cliente@ejemplo.com", "reason": "invalid_password"}	2025-04-20 10:57:12.28322-07
5	5	client_login	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"email": "test1745177152421@example.com", "portal": "client"}	2025-04-20 12:31:03.495183-07
6	7	client_login	::1	axios/1.8.4	{"email": "test1745177706237@example.com", "portal": "client"}	2025-04-20 12:35:06.510621-07
7	8	client_login	::1	axios/1.8.4	{"email": "test1745177793813@example.com", "portal": "client"}	2025-04-20 12:36:34.113461-07
8	8	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 8, "userAgent": "axios/1.8.4"}	2025-04-20 12:36:34.132703-07
9	8	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/csrf-token", "method": "GET", "userId": 8, "userAgent": "axios/1.8.4"}	2025-04-20 12:36:34.144826-07
10	8	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/applications", "method": "POST", "userId": 8, "userAgent": "axios/1.8.4"}	2025-04-20 12:36:34.159377-07
11	9	client_login	::1	axios/1.8.4	{"email": "test1745177837888@example.com", "portal": "client"}	2025-04-20 12:37:18.239366-07
12	9	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 9, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:18.257976-07
13	9	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/csrf-token", "method": "GET", "userId": 9, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:18.273047-07
14	9	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/applications", "method": "POST", "userId": 9, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:18.30145-07
15	9	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/applications", "method": "GET", "userId": 9, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:18.318629-07
16	10	client_login	::1	axios/1.8.4	{"email": "test1745177857680@example.com", "portal": "client"}	2025-04-20 12:37:37.990923-07
17	10	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 10, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:38.005196-07
18	10	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/csrf-token", "method": "GET", "userId": 10, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:38.017035-07
19	10	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/applications", "method": "POST", "userId": 10, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:38.039379-07
20	10	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/applications", "method": "GET", "userId": 10, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:38.05537-07
21	10	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/csrf-token", "method": "GET", "userId": 10, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:38.075987-07
22	10	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 10, "userAgent": "axios/1.8.4"}	2025-04-20 12:37:38.088206-07
23	11	client_login	::1	axios/1.8.4	{"email": "test1745177919233@example.com", "portal": "client"}	2025-04-20 12:38:39.579749-07
24	11	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 11, "userAgent": "axios/1.8.4"}	2025-04-20 12:38:39.598902-07
25	11	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/csrf-token", "method": "GET", "userId": 11, "userAgent": "axios/1.8.4"}	2025-04-20 12:38:39.612171-07
26	11	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/applications", "method": "POST", "userId": 11, "userAgent": "axios/1.8.4"}	2025-04-20 12:38:39.638517-07
27	11	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/applications", "method": "GET", "userId": 11, "userAgent": "axios/1.8.4"}	2025-04-20 12:38:39.65854-07
28	11	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/csrf-token", "method": "GET", "userId": 11, "userAgent": "axios/1.8.4"}	2025-04-20 12:38:39.67878-07
29	11	api_access	::1	axios/1.8.4	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 11, "userAgent": "axios/1.8.4"}	2025-04-20 12:38:39.690062-07
30	5	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/csrf-token", "method": "GET", "userId": 5, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 12:56:33.911476-07
31	5	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/csrf-token", "method": "GET", "userId": 5, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 12:56:37.834296-07
32	5	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/register", "method": "POST", "userId": 5, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 13:00:59.92188-07
33	20	registration_successful	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"email": "michaelperlasvp@gmail.com"}	2025-04-20 13:01:00.15918-07
34	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/login", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 13:01:11.670857-07
35	20	client_login	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"email": "michaelperlasvp@gmail.com", "portal": "client"}	2025-04-20 13:01:11.855333-07
36	\N	registration_failed	::1	curl/8.11.1	{"email": "test@example.com", "reason": "email_exists"}	2025-04-20 13:23:44.310823-07
37	4	failed_login	::1	curl/8.11.1	{"email": "test@example.com", "reason": "invalid_password"}	2025-04-20 13:23:51.65698-07
38	21	registration_successful	::1	curl/8.11.1	{"email": "test2@example.com"}	2025-04-20 13:24:01.001393-07
39	21	client_login	::1	curl/8.11.1	{"email": "test2@example.com", "portal": "client"}	2025-04-20 13:24:14.621079-07
40	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:24:18.248703-07
41	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/applications", "method": "POST", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:24:31.844342-07
42	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/applications", "method": "GET", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:24:36.430665-07
43	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/applications/6", "method": "PUT", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:24:50.05832-07
45	21	logout	::1	curl/8.11.1	{}	2025-04-20 13:24:54.711033-07
44	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:24:54.710929-07
46	1	failed_login	::1	curl/8.11.1	{"email": "admin@permisos-digitales.mx", "reason": "invalid_password"}	2025-04-20 13:26:24.15536-07
47	1	admin_login	::1	curl/8.11.1	{"email": "admin@permisos-digitales.mx", "portal": "admin"}	2025-04-20 13:28:37.621029-07
48	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/csrf-token", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:28:42.224174-07
49	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/dashboard-stats", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:28:46.561105-07
50	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/pending-verifications", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:28:51.865899-07
51	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/applications", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:28:56.123374-07
52	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/applications/6", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:29:00.467513-07
53	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/verification-history", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:29:05.005499-07
54	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:29:11.764415-07
55	1	logout	::1	curl/8.11.1	{}	2025-04-20 13:29:11.764642-07
56	21	client_login	::1	curl/8.11.1	{"email": "test2@example.com", "portal": "client"}	2025-04-20 13:29:27.922569-07
57	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/applications", "method": "POST", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:29:43.665881-07
58	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:29:50.859931-07
59	21	logout	::1	curl/8.11.1	{}	2025-04-20 13:29:50.860153-07
60	1	admin_login	::1	curl/8.11.1	{"email": "admin@permisos-digitales.mx", "portal": "admin"}	2025-04-20 13:30:00.126551-07
61	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/applications/7", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:30:04.470883-07
62	21	client_login	::1	curl/8.11.1	{"email": "test2@example.com", "portal": "client"}	2025-04-20 13:33:53.594922-07
63	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/applications", "method": "POST", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:34:09.696891-07
64	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/applications", "method": "POST", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:34:22.809473-07
65	21	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 21, "userAgent": "curl/8.11.1"}	2025-04-20 13:34:42.510463-07
66	21	logout	::1	curl/8.11.1	{}	2025-04-20 13:34:42.510667-07
67	1	admin_login	::1	curl/8.11.1	{"email": "admin@permisos-digitales.mx", "portal": "admin"}	2025-04-20 13:34:56.842175-07
68	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/csrf-token", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:35:06.294086-07
69	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/pending-verifications", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:35:10.797732-07
70	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/applications/8/verify-payment", "method": "POST", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:35:21.892947-07
71	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/applications/9/reject-payment", "method": "POST", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:35:32.395859-07
72	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/applications/8", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:35:37.132796-07
73	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/applications/9", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:35:42.093383-07
74	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/verification-history", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:35:47.025017-07
75	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/admin/dashboard-stats", "method": "GET", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:35:53.026484-07
77	1	logout	::1	curl/8.11.1	{}	2025-04-20 13:36:00.053155-07
76	1	api_access	::1	curl/8.11.1	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 1, "userAgent": "curl/8.11.1"}	2025-04-20 13:36:00.052927-07
78	20	client_login	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"email": "michaelperlasvp@gmail.com", "portal": "client"}	2025-04-20 14:21:41.399827-07
79	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:22:47.5587-07
80	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:16.506312-07
81	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:16.594719-07
82	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:19.812817-07
83	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:20.569332-07
84	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:20.648132-07
85	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:21.790001-07
86	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:24.18645-07
87	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:24.260151-07
88	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:25.32478-07
89	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:23:25.400984-07
90	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:14.926913-07
91	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:19.463673-07
92	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:19.582532-07
93	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:20.914486-07
94	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:24.027843-07
95	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:24.114877-07
96	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:25.63797-07
97	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:25.714961-07
98	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:31.255222-07
99	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:42.152292-07
100	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:47.971391-07
101	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:48.061072-07
102	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:49.740254-07
103	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:49.837113-07
104	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:35:50.57708-07
105	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:36:13.225937-07
106	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:36:21.398853-07
107	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:36:42.710912-07
108	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:36:47.193588-07
109	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:36:51.405157-07
110	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:36:54.085105-07
111	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:36:54.163276-07
112	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:41:48.100239-07
113	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:41:51.443241-07
114	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:41:52.381324-07
115	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:41:56.031649-07
116	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:42:15.422704-07
117	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:42:28.335889-07
118	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:42:29.929517-07
119	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:43:10.085424-07
120	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:43:25.298281-07
121	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:43:45.390259-07
122	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:45:38.440807-07
123	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:46:06.634429-07
124	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:46:21.046189-07
125	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:48:45.847381-07
126	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:49:29.75919-07
127	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:49:32.444749-07
128	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:49:34.940815-07
129	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:49:35.929234-07
130	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:49:36.324323-07
131	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 14:50:01.239287-07
132	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:01.38024-07
133	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:05.86658-07
134	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:11.301022-07
135	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:13.834481-07
136	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:13.915646-07
137	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:14.849941-07
138	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:14.920153-07
139	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:15.187793-07
143	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:15.685327-07
145	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:35.070518-07
140	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:15.365405-07
141	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:15.430026-07
142	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:15.598455-07
144	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:07:21.17013-07
146	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:10:23.522378-07
147	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:10:55.660394-07
148	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:11:13.967504-07
149	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:11:16.481735-07
150	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:11:16.538271-07
151	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:11:27.216348-07
152	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:11:29.121614-07
153	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:11:29.190641-07
154	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:11:31.38075-07
155	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:11:34.342773-07
156	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:11:34.418895-07
157	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:12:43.108565-07
158	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:12:57.163431-07
159	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:12:57.176486-07
160	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:13:12.165503-07
161	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:13:40.18109-07
162	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/logout", "method": "POST", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:13:41.736402-07
163	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/auth/status", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:13:41.804651-07
164	20	api_access	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0	{"ip": "::1", "path": "/applications/dashboard", "method": "GET", "userId": 20, "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0"}	2025-04-20 15:13:49.531697-07
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: permisos_admin
--

COPY public.user_sessions (sid, sess, expire) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: permisos_admin
--

COPY public.users (id, email, password_hash, first_name, last_name, role, account_type, created_by, is_admin_portal, account_created_at, created_at, updated_at) FROM stdin;
2	supervisor@permisos-digitales.mx	$2b$10$5CKstz45CgzUivOgfIepJumA//BdNH5QdCctUoZolJ6Q9dqtkBz5W	Ana	GutiÃ©rrez	admin	admin	\N	t	2025-04-20 10:56:14.686678-07	2025-04-20 10:56:14.686678-07	2025-04-20 10:56:14.686678-07
3	cliente@ejemplo.com	$2b$10$WMlXp8JU0cMXEpSQTDqQnuVZfM9RQT0HhCQMXeKEIwuqGKcz2nYbu	Carlos	LÃ³pez	client	client	\N	f	2025-04-20 10:56:14.687636-07	2025-04-20 10:56:14.687636-07	2025-04-20 10:56:14.687636-07
4	test@example.com	.YQp1xXCH5Kz.YNFVeQNpUXvVnGqHYdVjEEGYGHRTEeS	Test	User	client	client	\N	f	2025-04-20 12:24:41.425614-07	2025-04-20 12:24:41.425614-07	2025-04-20 12:24:41.425614-07
5	test1745177152421@example.com	$2b$10$tVwhZgMesYv0wN8qMdp46OdAkFl5A1F5g9GyayjxVp8DjQnHyoN3a	Test	User	client	client	\N	f	2025-04-20 12:25:52.471161-07	2025-04-20 12:25:52.471161-07	2025-04-20 12:25:52.471161-07
6	test1745177519736@example.com	$2b$10$8Nw7YXV5ilrL2wt8k.Fmm.dWJAA.2KyjjNaHIe2uCB2viBGoLwjMG	Test	User	client	client	\N	f	2025-04-20 12:31:59.786707-07	2025-04-20 12:31:59.786707-07	2025-04-20 12:31:59.786707-07
7	test1745177706237@example.com	$2b$10$7KO8.uKCQLH2ALfjCoS/j.dcv3.oN6aACAR/QXEmNx7rY9tfhGKaK	Test	User	client	client	\N	f	2025-04-20 12:35:06.348051-07	2025-04-20 12:35:06.348051-07	2025-04-20 12:35:06.348051-07
8	test1745177793813@example.com	$2b$10$dl11rtp6mE25J7SeJt4Vi.NA8L/5.uJNf4TLamUd443TL6ubqo67S	Test	User	client	client	\N	f	2025-04-20 12:36:33.921711-07	2025-04-20 12:36:33.921711-07	2025-04-20 12:36:33.921711-07
9	test1745177837888@example.com	$2b$10$Jh7DYBZgQNDs9ABQX/RNP.EBlI.yRgCV2kpe0Xtm6MFeG.iEHejsi	Test	User	client	client	\N	f	2025-04-20 12:37:18.016217-07	2025-04-20 12:37:18.016217-07	2025-04-20 12:37:18.016217-07
10	test1745177857680@example.com	$2b$10$YXYJZUnSaAQPoHjaUxjvXuZLJlR6mShPBUmAxGlDWw23yWZ5ZZsEy	Test	User	client	client	\N	f	2025-04-20 12:37:37.791797-07	2025-04-20 12:37:37.791797-07	2025-04-20 12:37:37.791797-07
11	test1745177919233@example.com	$2b$10$84a1iY7g5C1NyeSnuAcbXe7ahBsdMSfFe3Asdzvl.9tCXMsXl3MJe	Test	User	client	client	\N	f	2025-04-20 12:38:39.369515-07	2025-04-20 12:38:39.369515-07	2025-04-20 12:38:39.369515-07
12	test1745177928093@example.com	$2b$10$dDOcfbeNHULh854bg3wU1uApXWiRu.xOwArMhRlQP2KnIKTDJsJci	Test	User	client	client	\N	f	2025-04-20 12:38:48.201378-07	2025-04-20 12:38:48.201378-07	2025-04-20 12:38:48.201378-07
13	test1745177969828@example.com	$2b$10$//Aw7H.01NuRhxPPbj.iQ.2joFPNRLzZdts8W1VLLv/fPgSSFX9gS	Test	User	client	client	\N	f	2025-04-20 12:39:29.94274-07	2025-04-20 12:39:29.94274-07	2025-04-20 12:39:29.94274-07
14	test1745178058965@example.com	$2b$10$CwctfTRVqubgyzTIKOzWXevZh8Bb.U3RouI56HEMma/yePR7WjhMO	Test	User	client	client	\N	f	2025-04-20 12:40:59.082142-07	2025-04-20 12:40:59.082142-07	2025-04-20 12:40:59.082142-07
15	test1745178135200@example.com	$2b$10$8GUgd.lzEbMNW7l1jwcOMe3x8sR04ioGsNCuVpThem7TaAjuNhRB6	Test	User	client	client	\N	f	2025-04-20 12:42:15.310021-07	2025-04-20 12:42:15.310021-07	2025-04-20 12:42:15.310021-07
16	test1745178155472@example.com	$2b$10$ZgCzl6wALaeFeYNlwn3pw.vG407i3tucHlLRDOCFDP3x50sT0dnjy	Test	User	client	client	\N	f	2025-04-20 12:42:35.58225-07	2025-04-20 12:42:35.58225-07	2025-04-20 12:42:35.58225-07
17	test1745178184406@example.com	$2b$10$f42epfYo74N8DMhmClZMnOEyheMNJit1yhympGvcoI5CkLT3oluOe	Test	User	client	client	\N	f	2025-04-20 12:43:04.518951-07	2025-04-20 12:43:04.518951-07	2025-04-20 12:43:04.518951-07
18	test1745178277313@example.com	$2b$10$Mh5Ugh9S6e4nPh54TEd91.hSOAg8PPx98pFC1h0oxu2RquROZbiha	Test	User	client	client	\N	f	2025-04-20 12:44:37.425806-07	2025-04-20 12:44:37.425806-07	2025-04-20 12:44:37.425806-07
19	test1745179058624@example.com	$2b$10$z3A8XiJZ/M9PXj9oUosxWOHcaKkaV8.rLDW1SY0Ul9IVJu1u3IDcy	Test	User	client	client	\N	f	2025-04-20 12:57:38.682161-07	2025-04-20 12:57:38.682161-07	2025-04-20 12:57:38.682161-07
20	michaelperlasvp@gmail.com	100000:2050b27766dbb67a68e22fc3d81807cbcb2b84182b93fb220a47f04a9219403e:5def1e3b5948edbb4ffd6ec895dc914075a58a406f4edfe28c55c98bc936bc7624259457b45c1c58a3c703d35196acaa0e8fc65db56bea70c765a285580e570a	michael	perla	client	client	\N	f	2025-04-20 13:01:00.155061-07	2025-04-20 13:01:00.155061-07	2025-04-20 13:01:00.155061-07
21	test2@example.com	100000:63adb3c41b399e40fe78283c7d6c91d8bc1f9f859ac11496d5720a9b781303ef:762c1d8f5e5df39a5ce3cd17bfa3a24c7f51085cd6df0fb865df63dcee9040e150baf557a17b77d2a74ddefbe4a2dae86f316b8422fd69cce17dc544751b6adb	Test	User	client	client	\N	f	2025-04-20 13:24:00.999022-07	2025-04-20 13:24:00.999022-07	2025-04-20 13:24:00.999022-07
1	admin@permisos-digitales.mx	$2b$10$hVLP0pRxnMQ2I0hyMurwTOAJfaJ4NPCFEffUm3o5yas.fPS600iNG	Admin	User	admin	admin	\N	t	2025-04-20 10:56:14.682755-07	2025-04-20 10:56:14.682755-07	2025-04-20 13:28:27.909985-07
\.


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: permisos_admin
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- Name: payment_verification_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: permisos_admin
--

SELECT pg_catalog.setval('public.payment_verification_log_id_seq', 3, true);


--
-- Name: permit_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: permisos_admin
--

SELECT pg_catalog.setval('public.permit_applications_id_seq', 9, true);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: permisos_admin
--

SELECT pg_catalog.setval('public.schema_migrations_id_seq', 1, true);


--
-- Name: security_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: permisos_admin
--

SELECT pg_catalog.setval('public.security_audit_log_id_seq', 164, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: permisos_admin
--

SELECT pg_catalog.setval('public.users_id_seq', 22, true);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payment_verification_log payment_verification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.payment_verification_log
    ADD CONSTRAINT payment_verification_log_pkey PRIMARY KEY (id);


--
-- Name: permit_applications permit_applications_folio_key; Type: CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.permit_applications
    ADD CONSTRAINT permit_applications_folio_key UNIQUE (folio);


--
-- Name: permit_applications permit_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.permit_applications
    ADD CONSTRAINT permit_applications_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_version_key; Type: CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_version_key UNIQUE (version);


--
-- Name: security_audit_log security_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.security_audit_log
    ADD CONSTRAINT security_audit_log_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (sid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_user_sessions_expire; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX "IDX_user_sessions_expire" ON public.user_sessions USING btree (expire);


--
-- Name: idx_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_payment_verification_log_application_id; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_payment_verification_log_application_id ON public.payment_verification_log USING btree (application_id);


--
-- Name: idx_permit_applications_folio; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_permit_applications_folio ON public.permit_applications USING btree (folio);


--
-- Name: idx_permit_applications_numero_serie; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_permit_applications_numero_serie ON public.permit_applications USING btree (numero_serie);


--
-- Name: idx_permit_applications_renewed_from_id; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_permit_applications_renewed_from_id ON public.permit_applications USING btree (renewed_from_id);


--
-- Name: idx_permit_applications_status; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_permit_applications_status ON public.permit_applications USING btree (status);


--
-- Name: idx_permit_applications_user_id; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_permit_applications_user_id ON public.permit_applications USING btree (user_id);


--
-- Name: idx_permit_applications_user_id_created_at; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_permit_applications_user_id_created_at ON public.permit_applications USING btree (user_id, created_at);


--
-- Name: idx_security_audit_log_action_type; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_security_audit_log_action_type ON public.security_audit_log USING btree (action_type);


--
-- Name: idx_security_audit_log_created_at; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_security_audit_log_created_at ON public.security_audit_log USING btree (created_at);


--
-- Name: idx_security_audit_log_user_id; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE INDEX idx_security_audit_log_user_id ON public.security_audit_log USING btree (user_id);


--
-- Name: idx_users_email_unique; Type: INDEX; Schema: public; Owner: permisos_admin
--

CREATE UNIQUE INDEX idx_users_email_unique ON public.users USING btree (email);


--
-- Name: permit_applications update_permit_applications_modtime; Type: TRIGGER; Schema: public; Owner: permisos_admin
--

CREATE TRIGGER update_permit_applications_modtime BEFORE UPDATE ON public.permit_applications FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: users update_users_modtime; Type: TRIGGER; Schema: public; Owner: permisos_admin
--

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payment_verification_log payment_verification_log_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.payment_verification_log
    ADD CONSTRAINT payment_verification_log_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.permit_applications(id) ON DELETE CASCADE;


--
-- Name: payment_verification_log payment_verification_log_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.payment_verification_log
    ADD CONSTRAINT payment_verification_log_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: permit_applications permit_applications_payment_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.permit_applications
    ADD CONSTRAINT permit_applications_payment_verified_by_fkey FOREIGN KEY (payment_verified_by) REFERENCES public.users(id);


--
-- Name: permit_applications permit_applications_renewed_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.permit_applications
    ADD CONSTRAINT permit_applications_renewed_from_id_fkey FOREIGN KEY (renewed_from_id) REFERENCES public.permit_applications(id) ON DELETE SET NULL;


--
-- Name: permit_applications permit_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.permit_applications
    ADD CONSTRAINT permit_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: security_audit_log security_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.security_audit_log
    ADD CONSTRAINT security_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: permisos_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

