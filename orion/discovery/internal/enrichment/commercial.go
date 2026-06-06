// Package enrichment detecta señales comerciales desde contenido HTML.
package enrichment

import (
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// CommercialSignals agrupa todas las señales comerciales detectadas.
type CommercialSignals struct {
	HasEcommerce      bool   `json:"has_ecommerce"`
	HasPaymentGateway bool   `json:"has_payment_gateway"`
	HasAnalytics      bool   `json:"has_analytics"`
	HasCRM            bool   `json:"has_crm"`
	HasBooking        bool   `json:"has_booking"`
	HasAds            bool   `json:"has_ads"`
	ContentFreshness  int    `json:"content_freshness"` // Days since last blog post/page update (0 = unknown)
	PriceRange        string `json:"price_range"`       // "low", "mid", "high"
	PhysicalLocation  string `json:"physical_location"`
	SocialActivity    bool   `json:"social_activity"`
	IsPremiumHosting  bool   `json:"is_premium_hosting"`
	HasPricingPage    bool   `json:"has_pricing_page"`
	HasTestimonials   bool   `json:"has_testimonials"`
	HasPortfolio      bool   `json:"has_portfolio"`
	HasSchemaOrg      bool   `json:"has_schema_org"`
	HasBlog           bool   `json:"has_blog"`
	LastBlogDays      int    `json:"last_blog_days"` // Days since last blog post (0 = unknown)
	HasCTA            bool   `json:"has_cta"`
	RevenueSignal     string `json:"revenue_signal"` // "ecommerce", "subscription", "services", "ads", "none"
	IsSmallBusiness   bool   `json:"is_small_business"`
	ContactEmail      string `json:"contact_email"`
}

var (
	// E-commerce platforms
	ecommercePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)wp-content/plugins/woocommerce`),
		regexp.MustCompile(`(?i)cdn\.shopify\.com`),
		regexp.MustCompile(`(?i)shopify-buy`),
		regexp.MustCompile(`(?i)mage\.\w+`),
		regexp.MustCompile(`(?i)varien`),
		regexp.MustCompile(`(?i)prestashop`),
	}

	// Payment gateways
	paymentPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)js\.stripe\.com`),
		regexp.MustCompile(`(?i)mercadopago\.com`),
		regexp.MustCompile(`(?i)paypal\.com/js`),
		regexp.MustCompile(`(?i)squareup\.com`),
	}

	// Analytics
	analyticsPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)googletagmanager\.com/gtag`),
		regexp.MustCompile(`(?i)google-analytics\.com/analytics\.js`),
		regexp.MustCompile(`(?i)googletagmanager\.com/gtm`),
		regexp.MustCompile(`(?i)facebook\.com/tr`),
		regexp.MustCompile(`(?i)fbq\(`),
		regexp.MustCompile(`(?i)hotjar\.com`),
	}

	// CRM & booking
	crmPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)js\.hs-scripts\.com`),
		regexp.MustCompile(`(?i)hs-forms`),
		regexp.MustCompile(`(?i)salesforce\.com`),
		regexp.MustCompile(`(?i)calendly\.com`),
		regexp.MustCompile(`(?i)typeform\.com`),
	}

	// Booking platforms / keywords
	bookingPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)calendly\.com`),
		regexp.MustCompile(`(?i)reserva`),
		regexp.MustCompile(`(?i)booking`),
		regexp.MustCompile(`(?i)turno`),
	}

	// Ads
	adsPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)googleadservices\.com`),
		regexp.MustCompile(`(?i)fbq\('track'\)`),
	}

	// Premium hosting
	premiumHostingPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)cloudflare`),
		regexp.MustCompile(`(?i)aws\.amazon`),
		regexp.MustCompile(`(?i)amazonaws\.com`),
	}

	phonePattern        = regexp.MustCompile(`(?i)(\+\d[\d\s\-\(\)]{7,}|\(\d{2,}\)[\d\s\-]{6,}|[\d]{3,}[\s\-][\d]{3,}[\s\-][\d]{3,})`)
	addressPattern      = regexp.MustCompile(`(?i)(calle|avenida|av\.|plaza|pasaje|paseo|carretera|km\s?\d|cp\s?\d{4,5}|código postal|zip code)`)
	hoursPattern        = regexp.MustCompile(`(?i)(horario|horarios|hours|horas de atención|abierto de|cerrado)`)
	whatsappPattern     = regexp.MustCompile(`(?i)(wa\.me|api\.whatsapp\.com|whatsapp)`)
	gmapsPattern        = regexp.MustCompile(`(?i)(google\.com/maps|maps\.google|maps\.embed|iframe.*maps)`)
	aboutUsPattern      = regexp.MustCompile(`(?i)(sobre nosotros|quienes somos|nuestro equipo|equipo|conócenos|conocenos|about us|our team)`)
	localPaymentPattern = regexp.MustCompile(`(?i)(bizum|transferencia|efectivo|pago en tienda|pago contra reembolso|pago en local|metálico)`)
	emailRegex          = regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)
)

func extractEmails(html string) string {
	matches := emailRegex.FindAllString(html, 10)
	for _, email := range matches {
		lower := strings.ToLower(email)
		if strings.Contains(lower, "example.com") ||
			strings.Contains(lower, "sentry.io") ||
			strings.Contains(lower, "webpack") ||
			strings.Contains(lower, "wixpress.com") ||
			strings.Contains(lower, "email.com") ||
			strings.Contains(lower, "domain.com") ||
			strings.Contains(lower, "yourname") ||
			strings.Contains(lower, "username") {
			continue
		}
		return email
	}
	if len(matches) > 0 {
		return matches[0]
	}
	return ""
}

func extractMailtoEmails(doc *goquery.Document) string {
	var emails []string
	doc.Find("a[href^='mailto:']").Each(func(_ int, sel *goquery.Selection) {
		href, _ := sel.Attr("href")
		if strings.HasPrefix(href, "mailto:") {
			email := strings.TrimPrefix(href, "mailto:")
			// Remove any query params (e.g., ?subject=...)
			if idx := strings.Index(email, "?"); idx != -1 {
				email = email[:idx]
			}
			email = strings.TrimSpace(email)
			if email != "" {
				emails = append(emails, email)
			}
		}
	})
	for _, email := range emails {
		lower := strings.ToLower(email)
		if strings.Contains(lower, "example.com") ||
			strings.Contains(lower, "sentry.io") ||
			strings.Contains(lower, "webpack") ||
			strings.Contains(lower, "wixpress.com") ||
			strings.Contains(lower, "email.com") ||
			strings.Contains(lower, "domain.com") ||
			strings.Contains(lower, "yourname") ||
			strings.Contains(lower, "username") {
			continue
		}
		return email
	}
	if len(emails) > 0 {
		return emails[0]
	}
	return ""
}

// DetectSignals analiza el HTML y la URL para extraer señales comerciales.
func DetectSignals(html string, url string) *CommercialSignals {
	s := &CommercialSignals{RevenueSignal: "none"}

	// Use goquery for DOM-based detection
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		doc = nil
	}

	// E-commerce detection
	for _, re := range ecommercePatterns {
		if re.MatchString(html) {
			s.HasEcommerce = true
			break
		}
	}

	// Payment gateway detection
	for _, re := range paymentPatterns {
		if re.MatchString(html) {
			s.HasPaymentGateway = true
			break
		}
	}

	// Analytics detection
	for _, re := range analyticsPatterns {
		if re.MatchString(html) {
			s.HasAnalytics = true
			break
		}
	}

	// CRM detection
	for _, re := range crmPatterns {
		if re.MatchString(html) {
			s.HasCRM = true
			break
		}
	}

	// Booking detection (patterns in HTML + links/buttons text)
	for _, re := range bookingPatterns {
		if re.MatchString(html) {
			s.HasBooking = true
			break
		}
	}

	// Ads detection
	for _, re := range adsPatterns {
		if re.MatchString(html) {
			s.HasAds = true
			break
		}
	}

	// Premium hosting
	for _, re := range premiumHostingPatterns {
		if re.MatchString(html) {
			s.IsPremiumHosting = true
			break
		}
	}

	// Email extraction: prefer mailto: links over regex
	if doc != nil {
		if email := extractMailtoEmails(doc); email != "" {
			s.ContactEmail = email
		}
	}
	if s.ContactEmail == "" {
		if email := extractEmails(html); email != "" {
			s.ContactEmail = email
		}
	}

	if doc != nil {
		// Pricing page detection
		doc.Find("a").Each(func(_ int, sel *goquery.Selection) {
			href, _ := sel.Attr("href")
			text := strings.ToLower(sel.Text())
			combined := strings.ToLower(href + " " + text)
			if strings.Contains(combined, "precio") || strings.Contains(combined, "pricing") ||
				strings.Contains(combined, "plan") || strings.Contains(combined, "tarifa") {
				s.HasPricingPage = true
			}
		})

		// Testimonials detection
		htmlLower := strings.ToLower(html)
		if strings.Contains(htmlLower, "testimonio") || strings.Contains(htmlLower, "review") ||
			strings.Contains(htmlLower, "opinion") || strings.Contains(htmlLower, "cliente") ||
			strings.Contains(htmlLower, "testimonial") {
			s.HasTestimonials = true
		}

		// Portfolio detection
		doc.Find("a").Each(func(_ int, sel *goquery.Selection) {
			href, _ := sel.Attr("href")
			text := strings.ToLower(sel.Text())
			combined := strings.ToLower(href + " " + text)
			if strings.Contains(combined, "portfolio") || strings.Contains(combined, "galeria") ||
				strings.Contains(combined, "trabajos") || strings.Contains(combined, "proyectos") {
				s.HasPortfolio = true
			}
		})

		// Schema.org detection
		doc.Find("script[type='application/ld+json']").Each(func(_ int, _ *goquery.Selection) {
			s.HasSchemaOrg = true
		})

		// Blog detection
		doc.Find("a").Each(func(_ int, sel *goquery.Selection) {
			href, _ := sel.Attr("href")
			text := strings.ToLower(sel.Text())
			combined := strings.ToLower(href + " " + text)
			if strings.Contains(combined, "blog") || strings.Contains(combined, "noticias") ||
				strings.Contains(combined, "articulos") || strings.Contains(combined, "news") {
				s.HasBlog = true
			}
		})

		// CTA above fold (first 50 lines of HTML)
		lines := strings.Split(html, "\n")
		firstChunk := ""
		if len(lines) > 50 {
			firstChunk = strings.Join(lines[:50], "\n")
		} else {
			firstChunk = html
		}
		firstChunkLower := strings.ToLower(firstChunk)
		ctaKeywords := []string{
			"contactar", "contacto", "contact us", "contactanos", "contáctanos",
			"comprar", "buy now", "reservar", "cotizar", "solicitar",
			"get started", "free trial", "llámanos", "llamenos", "escríbenos",
			"más información", "subscribe", "join now", "book now", "sign up",
			"request quote", "pedir presupuesto", "agendar",
		}
		for _, kw := range ctaKeywords {
			if strings.Contains(firstChunkLower, kw) {
				s.HasCTA = true
				break
			}
		}

		// Social activity: look for social links
		socialDomains := []string{"facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com", "tiktok.com", "youtube.com"}
		doc.Find("a[href]").Each(func(_ int, sel *goquery.Selection) {
			if s.SocialActivity {
				return
			}
			href, _ := sel.Attr("href")
			for _, domain := range socialDomains {
				if strings.Contains(href, domain) {
					s.SocialActivity = true
					return
				}
			}
		})

		// Physical location from schema.org or contact
		doc.Find("script[type='application/ld+json']").Each(func(_ int, sel *goquery.Selection) {
			scriptText := sel.Text()
			if strings.Contains(strings.ToLower(scriptText), "address") ||
				strings.Contains(strings.ToLower(scriptText), "postaladdress") {
				// Basic extraction - just flag presence
				if s.PhysicalLocation == "" {
					s.PhysicalLocation = "detected"
				}
			}
		})
	}

	// Small business signal detection
	s.detectSmallBusiness(html)

	// Revenue signal classification
	s.classifyRevenue()

	return s
}

func (s *CommercialSignals) detectSmallBusiness(html string) {
	score := 0
	if phonePattern.MatchString(html) {
		score++
	}
	if addressPattern.MatchString(html) {
		score++
	}
	if hoursPattern.MatchString(html) {
		score++
	}
	if whatsappPattern.MatchString(html) {
		score++
	}
	if gmapsPattern.MatchString(html) {
		score++
	}
	if aboutUsPattern.MatchString(html) {
		score++
	}
	if localPaymentPattern.MatchString(html) {
		score++
	}
	if score >= 3 {
		s.IsSmallBusiness = true
	}
}

func (s *CommercialSignals) classifyRevenue() {
	if s.HasEcommerce && s.HasPaymentGateway {
		s.RevenueSignal = "ecommerce"
		s.PriceRange = "mid"
		return
	}
	if s.HasPricingPage {
		s.RevenueSignal = "subscription"
		return
	}
	if s.HasBooking || s.HasCRM {
		s.RevenueSignal = "services"
		return
	}
	if s.HasAds {
		s.RevenueSignal = "ads"
		return
	}
	s.RevenueSignal = "none"
}
