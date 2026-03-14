---
title: "Spring Boot Senior - Guía Completa de Estudio"
description: "Guía completa de Spring Boot para entrevistas senior: IoC, REST, seguridad, testing y más."
tags: ["spring-boot", "senior", "entrevistas"]
date: "2024-01-01"
---

# Spring Boot Senior - Guía Completa de Estudio

---

## 1. Spring Core - IoC y Dependency Injection

### ¿Qué es IoC (Inversion of Control)?

**Definición**: Es un principio donde el control de creación y gestión de objetos se invierte — en lugar de que TÚ crees los objetos, el **framework** los crea y los gestiona.

**Sin IoC (control en tus manos)**:
```java
public class OrderService {
    private PaymentService paymentService = new PaymentService(); // tú controlas
    private OrderRepository repo = new OrderRepository(new DataSource(...));
}
```

**Con IoC (control en Spring)**:
```javad
@Service
public class OrderService {
    private final PaymentService paymentService; // Spring lo provee
    private final OrderRepository repo;

    public OrderService(PaymentService paymentService, OrderRepository repo) {
        this.paymentService = paymentService;
        this.repo = repo;
    }
}
```

**Por qué existe**: Para desacoplar componentes, facilitar testing, y centralizar la configuración. El código no sabe cómo se crean sus dependencias, solo declara que las necesita.

---

### BeanFactory vs ApplicationContext

| | BeanFactory | ApplicationContext |
|--|-------------|-------------------|
| **Qué es** | Contenedor básico de Spring | Extensión avanzada de BeanFactory |
| **Carga de beans** | Lazy (al pedirlos) | Eager (al arrancar) |
| **Internationalization** | No | Sí (`MessageSource`) |
| **Eventos** | No | Sí (`ApplicationEventPublisher`) |
| **AOP** | Limitado | Completo |
| **Integración web** | No | Sí |
| **Uso** | Casos de muy bajo recurso | TODO uso real en producción |

**Cuándo usar BeanFactory**: Casi nunca en aplicaciones reales. Solo en entornos con restricciones de memoria extremas (embedded devices).

**Cuándo usar ApplicationContext**: Siempre. En Spring Boot lo tienes automáticamente vía `SpringApplication.run()`.

```java
// ApplicationContext implementations más comunes:
ApplicationContext ctx1 = new AnnotationConfigApplicationContext(AppConfig.class); // config Java
ApplicationContext ctx2 = new ClassPathXmlApplicationContext("beans.xml"); // config XML (legacy)
ApplicationContext ctx3 = new GenericWebApplicationContext(); // web apps
```

**Curiosidad de examen**: `ApplicationContext` extiende `BeanFactory` — es un BeanFactory con esteroides. Si alguien te pregunta "¿qué relación tienen?", la respuesta es herencia.

---

### Ciclo de Vida Completo de un Bean

```
1. Instanciación (new)
       ↓
2. Inyección de dependencias (setters/constructor)
       ↓
3. BeanNameAware.setBeanName()
       ↓
4. BeanFactoryAware.setBeanFactory()
       ↓
5. ApplicationContextAware.setApplicationContext()
       ↓
6. BeanPostProcessor.postProcessBeforeInitialization()
       ↓
7. @PostConstruct
       ↓
8. InitializingBean.afterPropertiesSet()
       ↓
9. @Bean(initMethod = "customInit")
       ↓
10. BeanPostProcessor.postProcessAfterInitialization()
       ↓
11. ← BEAN LISTO PARA USAR →
       ↓
12. @PreDestroy
       ↓
13. DisposableBean.destroy()
       ↓
14. @Bean(destroyMethod = "customDestroy")
```

**Orden de inicialización** (muy preguntado):
`@PostConstruct` → `afterPropertiesSet()` → `initMethod`

**Orden de destrucción**:
`@PreDestroy` → `destroy()` → `destroyMethod`

```java
@Component
public class MyBean implements InitializingBean, DisposableBean {

    @PostConstruct
    public void postConstruct() {
        System.out.println("1. @PostConstruct");
    }

    @Override
    public void afterPropertiesSet() {
        System.out.println("2. afterPropertiesSet");
    }

    @PreDestroy
    public void preDestroy() {
        System.out.println("3. @PreDestroy");
    }

    @Override
    public void destroy() {
        System.out.println("4. destroy()");
    }
}
```

**Cuándo usar cada uno**:
- `@PostConstruct`: inicializar recursos, validar configuración. **Preferido** (estándar Java, no acopla a Spring).
- `afterPropertiesSet()`: cuando quieres acoplarte intencionalmente a Spring (raro).
- `initMethod` en `@Bean`: cuando configuras beans de terceros sin poder anotarlos.

**Debilidades/Trampas**:
- `@PostConstruct` en un bean `prototype` se llama en cada creación, pero `@PreDestroy` **NO** se llama (Spring no trackea instancias prototype).
- Si `@PostConstruct` lanza excepción, el contexto falla al arrancar.

---

### Scopes de Beans

| Scope | Instancias | Cuándo usar |
|-------|-----------|-------------|
| `singleton` | 1 por ApplicationContext | Servicios sin estado (default) |
| `prototype` | Nueva por cada `getBean()` | Objetos con estado mutable |
| `request` | 1 por request HTTP | Datos de la request actual |
| `session` | 1 por sesión HTTP | Carrito de compras, preferencias usuario |
| `application` | 1 por ServletContext | Configuración compartida por toda la app web |
| `websocket` | 1 por sesión WebSocket | Apps de chat, notificaciones en tiempo real |

**El problema clásico: prototype dentro de singleton**

```java
// PROBLEMA: prototype se convierte en singleton de facto
@Component // singleton por default
public class SingletonBean {
    @Autowired
    private PrototypeBean prototypeBean; // se inyecta UNA VEZ al crear SingletonBean
    // prototypeBean nunca cambia aunque sea prototype!
}
```

**Soluciones**:

```java
// Solución 1: ApplicationContext (funcional pero acopla al framework)
@Component
public class SingletonBean {
    @Autowired
    private ApplicationContext context;

    public void doWork() {
        PrototypeBean fresh = context.getBean(PrototypeBean.class); // nueva cada vez
    }
}

// Solución 2: @Lookup (más limpio, Spring genera la implementación)
@Component
public abstract class SingletonBean {
    @Lookup
    public abstract PrototypeBean getPrototype(); // Spring implementa este método

    public void doWork() {
        PrototypeBean fresh = getPrototype();
    }
}

// Solución 3: ObjectFactory / ObjectProvider (preferida en código moderno)
@Component
public class SingletonBean {
    @Autowired
    private ObjectProvider<PrototypeBean> prototypeProvider;

    public void doWork() {
        PrototypeBean fresh = prototypeProvider.getObject();
    }
}
```

**Curiosidad de examen**: `ObjectProvider` es la evolución de `ObjectFactory`. Además de `getObject()`, ofrece `getIfAvailable()` y `getIfUnique()` para manejar beans opcionales o con múltiples candidatos.

---

### Tipos de Inyección de Dependencias

#### Constructor Injection (PREFERIDA)
```java
@Service
public class OrderService {
    private final OrderRepository repository;
    private final PaymentService paymentService;

    // @Autowired opcional si hay un solo constructor (Spring 4.3+)
    public OrderService(OrderRepository repository, PaymentService paymentService) {
        this.repository = repository;
        this.paymentService = paymentService;
    }
}
```

**Por qué es la mejor**:
1. Dependencias `final` → inmutabilidad garantizada
2. Dependencias visibles (nadie puede crear la clase sin sus dependencias)
3. Facilita testing: `new OrderService(mockRepo, mockPayment)` sin Spring
4. Spring detecta dependencias circulares al arrancar, no en runtime
5. Herramienta como Lombok `@RequiredArgsConstructor` la hace aún más limpia

#### Field Injection (NO RECOMENDADA)
```java
@Service
public class OrderService {
    @Autowired
    private OrderRepository repository; // campo no-final, acceso por reflexión
}
```

**Por qué evitarla**:
- No puedes hacer `final` → mutabilidad
- Oculta dependencias (alguien puede crear la clase y no saber que necesita un repo)
- Para testear necesitas Spring o reflexión: `ReflectionTestUtils.setField()`
- IntelliJ te da warning "Field injection is not recommended"

#### Setter Injection (para dependencias OPCIONALES)
```java
@Service
public class NotificationService {
    private EmailService emailService; // opcional

    @Autowired(required = false)
    public void setEmailService(EmailService emailService) {
        this.emailService = emailService;
    }
}
```

**Cuándo usarla**: Solo cuando la dependencia es genuinamente opcional o cuando hay dependencia circular que no puedes romper.

---

### Resolución de Ambigüedad

Cuando Spring encuentra múltiples beans del mismo tipo, necesita desambiguar:

```java
// Caso: tienes dos implementaciones de PaymentService
@Component("stripePayment")
public class StripePaymentService implements PaymentService {}

@Component("paypalPayment")
public class PaypalPaymentService implements PaymentService {}
```

**@Primary**: el bean preferido por default
```java
@Component
@Primary
public class StripePaymentService implements PaymentService {}

@Service
public class OrderService {
    @Autowired
    private PaymentService paymentService; // inyecta StripePaymentService automáticamente
}
```

**@Qualifier**: selección explícita
```java
@Service
public class OrderService {
    @Autowired
    @Qualifier("paypalPayment")
    private PaymentService paymentService; // fuerza PaypalPaymentService
}
```

**@Profile**: beans según ambiente
```java
@Bean
@Profile("prod")
public DataSource prodDataSource() { /* RDS, pool de conexiones real */ }

@Bean
@Profile("dev")
public DataSource devDataSource() { /* H2 en memoria */ }

@Bean
@Profile("!prod") // cualquier perfil que NO sea prod
public MockEmailService emailService() { /* no envía emails reales */ }
```

**@Conditional**: condición personalizada
```java
public class OnDockerCondition implements Condition {
    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return Files.exists(Path.of("/.dockerenv")); // true si corre en Docker
    }
}

@Bean
@Conditional(OnDockerCondition.class)
public MetricsExporter dockerMetrics() { /* solo en Docker */ }
```

**Trampa de examen**: Si tienes dos beans del mismo tipo sin `@Primary` ni `@Qualifier`, Spring lanza `NoUniqueBeanDefinitionException` al arrancar — no en runtime cuando se usa.

---

## 2. Spring Boot - Auto-Configuration

### ¿Qué es y por qué existe?

**Sin Auto-Configuration** (Spring Framework puro):
```java
@Configuration
public class AppConfig {
    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:postgresql://localhost/mydb");
        ds.setUsername("user");
        ds.setPassword("pass");
        return ds;
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource ds) {
        return new JdbcTemplate(ds);
    }

    @Bean
    public TransactionManager transactionManager(DataSource ds) {
        return new DataSourceTransactionManager(ds);
    }
    // ... 20 beans más de configuración boilerplate
}
```

**Con Auto-Configuration** (Spring Boot):
```yaml
# application.yml - esto es todo lo que necesitas
spring:
  datasource:
    url: jdbc:postgresql://localhost/mydb
    username: user
    password: pass
```
Spring Boot detecta que tienes PostgreSQL en el classpath y configura todo automáticamente.

### Cómo funciona internamente

```
@SpringBootApplication
    ↓ incluye
@EnableAutoConfiguration
    ↓ activa
AutoConfigurationImportSelector
    ↓ lee
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
    ↓ lista ~130+ clases de auto-configuración
    ↓ cada una tiene condiciones @Conditional
    ↓ si se cumplen → bean registrado
    ↓ si no → ignorado
```

**Ejemplo real de auto-configuración interna de Spring Boot**:
```java
@AutoConfiguration
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")
@EnableConfigurationProperties(DataSourceProperties.class)
@Import({ DataSourcePoolMetadataProvidersConfiguration.class,
          DataSourceInitializationConfiguration.class })
public class DataSourceAutoConfiguration {

    @Configuration(proxyBeanMethods = false)
    @Conditional(EmbeddedDatabaseCondition.class)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @Import(EmbeddedDataSourceConfiguration.class)
    protected static class EmbeddedDatabaseConfiguration {}

    @Configuration(proxyBeanMethods = false)
    @Conditional(PooledDataSourceCondition.class)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @Import({ DataSourceConfiguration.Hikari.class, /* otros pools */ })
    protected static class PooledDataSourceConfiguration {}
}
```

**La regla de oro**: `@ConditionalOnMissingBean` significa "solo configuro esto si el usuario no lo configuró ya". Esto permite que **siempre puedas sobrescribir** cualquier auto-configuración.

### Condiciones más importantes

| Anotación | Cuándo el bean se registra |
|-----------|---------------------------|
| `@ConditionalOnClass(Foo.class)` | Si `Foo` está en el classpath |
| `@ConditionalOnMissingClass("com.Foo")` | Si `Foo` NO está en el classpath |
| `@ConditionalOnBean(Foo.class)` | Si ya existe un bean de tipo `Foo` |
| `@ConditionalOnMissingBean(Foo.class)` | Si NO existe un bean de tipo `Foo` |
| `@ConditionalOnProperty("app.feature.enabled")` | Si la propiedad es `true` |
| `@ConditionalOnWebApplication` | Si es una app web |
| `@ConditionalOnNotWebApplication` | Si NO es una app web |
| `@ConditionalOnExpression("${app.x} > 5")` | Basado en expresión SpEL |
| `@ConditionalOnResource("classpath:foo.xml")` | Si el recurso existe |
| `@ConditionalOnJava(JavaVersion.SEVENTEEN)` | Si es Java 17+ |

### Cómo crear tu propia Auto-Configuration (librería)

```java
// 1. Crear la clase de auto-configuración
@AutoConfiguration
@ConditionalOnClass(MyClient.class)
@ConditionalOnProperty(prefix = "my.client", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(MyClientProperties.class)
public class MyClientAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean // respeta si el usuario define el suyo
    public MyClient myClient(MyClientProperties props) {
        return MyClient.builder()
            .url(props.getUrl())
            .timeout(props.getTimeout())
            .build();
    }
}

// 2. Registrar en el archivo imports (Spring Boot 3+)
// src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.mylib.autoconfigure.MyClientAutoConfiguration
```

### Debugging de Auto-Configuration

```bash
# Opción 1: flag al arrancar
java -jar app.jar --debug

# Opción 2: en application.properties
logging.level.org.springframework.boot.autoconfigure=DEBUG

# Opción 3: ver en runtime via Actuator
GET /actuator/conditions
```

La salida te dice:
- **Positive matches**: auto-configs que SÍ se activaron y por qué
- **Negative matches**: auto-configs que NO se activaron y la condición que falló
- **Exclusions**: las que excluiste explícitamente

**Cómo excluir una auto-configuración**:
```java
@SpringBootApplication(exclude = { DataSourceAutoConfiguration.class })
public class MyApp {}

// O en properties:
// spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
```

**Curiosidades de examen**:
- En Spring Boot 2.x se usaba `spring.factories`. En Spring Boot 3+ se usa el archivo `.imports`. Spring Boot 3 sigue soportando `spring.factories` por compatibilidad pero está deprecado.
- Las auto-configuraciones se procesan en orden — puedes usar `@AutoConfigureBefore` y `@AutoConfigureAfter` para controlar el orden entre ellas.
- `@SpringBootApplication` = `@Configuration` + `@EnableAutoConfiguration` + `@ComponentScan`. Conocer esto es fundamental.

---

## 3. Spring MVC y REST

### Flujo completo de una Request HTTP

```
Cliente HTTP
    ↓ HTTP Request
DispatcherServlet (front controller - único punto de entrada)
    ↓ consulta
HandlerMapping (¿qué controller maneja esta URL?)
    ↓ retorna HandlerExecutionChain (handler + interceptors)
HandlerInterceptor.preHandle() (uno por uno)
    ↓ si todos retornan true
HandlerAdapter (¿cómo invocar el handler?)
    ↓ ejecuta
@Controller method
    ↓ retorna ModelAndView o @ResponseBody
HandlerInterceptor.postHandle()
    ↓
ViewResolver (si es vista) | HttpMessageConverter (si es JSON/XML)
    ↓
HandlerInterceptor.afterCompletion()
    ↓
HTTP Response → Cliente
```

**Por qué existe DispatcherServlet**: Centraliza todo el procesamiento de requests. Sin él, tendrías que registrar un servlet por cada endpoint — el patrón Front Controller.

### Anotaciones REST clave

```java
@RestController                          // @Controller + @ResponseBody
@RequestMapping("/api/v1/orders")        // prefijo para todos los endpoints
public class OrderController {

    // GET con path variable y query param
    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> findById(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean includeItems,
            @RequestHeader("X-Correlation-ID") String correlationId) {
        return ResponseEntity.ok(service.findById(id));
    }

    // POST con body y validación
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)  // 201 automáticamente
    public OrderDto create(@Valid @RequestBody CreateOrderRequest request) {
        return service.create(request);
    }

    // PUT completo
    @PutMapping("/{id}")
    public OrderDto update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrderRequest request) {
        return service.update(id, request);
    }

    // PATCH parcial
    @PatchMapping("/{id}/status")
    public OrderDto updateStatus(
            @PathVariable Long id,
            @RequestBody @Valid UpdateStatusRequest request) {
        return service.updateStatus(id, request.status());
    }

    // DELETE
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT) // 204
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
```

**ResponseEntity vs @ResponseStatus**:
- `ResponseEntity<T>`: control total (headers, status, body dinámico según lógica)
- `@ResponseStatus`: status fijo declarativo, más simple

```java
// ResponseEntity te da control total
public ResponseEntity<OrderDto> create(...) {
    OrderDto dto = service.create(request);
    URI location = URI.create("/api/orders/" + dto.id());
    return ResponseEntity.created(location).body(dto); // 201 + Location header + body
}
```

### Manejo Global de Errores

```java
@RestControllerAdvice  // = @ControllerAdvice + @ResponseBody
public class GlobalExceptionHandler {

    // Entidad no encontrada → 404
    @ExceptionHandler(EntityNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(EntityNotFoundException ex, WebRequest request) {
        return new ErrorResponse("NOT_FOUND", ex.getMessage(), request.getDescription(false));
    }

    // Validación fallida → 400
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .toList();
        return new ErrorResponse("VALIDATION_ERROR", errors);
    }

    // Acceso denegado → 403
    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ErrorResponse handleAccessDenied(AccessDeniedException ex) {
        return new ErrorResponse("FORBIDDEN", "Access denied");
    }

    // Catch-all → 500
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);
        return new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred");
    }
}
```

**Problem Details (RFC 7807)** - Spring Boot 3 lo soporta nativamente:
```yaml
spring:
  mvc:
    problemdetails:
      enabled: true
```
Esto cambia el formato de error a:
```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Order with id 123 not found",
  "instance": "/api/orders/123"
}
```

### Validación con Bean Validation

```java
// DTO con validaciones
public record CreateOrderRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    String customerEmail,

    @NotNull
    @Positive(message = "Amount must be positive")
    BigDecimal amount,

    @NotEmpty
    @Size(min = 1, max = 50)
    List<@Valid OrderItemRequest> items
) {}

// Validación en cascada con @Valid
public record OrderItemRequest(
    @NotNull Long productId,
    @Min(1) Integer quantity
) {}
```

**Validación a nivel de clase** (cross-field):
```java
@CheckDates // anotación custom
public record DateRange(LocalDate start, LocalDate end) {}

@Constraint(validatedBy = CheckDatesValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface CheckDates {
    String message() default "Start date must be before end date";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

public class CheckDatesValidator implements ConstraintValidator<CheckDates, DateRange> {
    @Override
    public boolean isValid(DateRange range, ConstraintValidatorContext ctx) {
        if (range.start() == null || range.end() == null) return true;
        return range.start().isBefore(range.end());
    }
}
```

### Filters vs HandlerInterceptors

| Aspecto | Filter (javax/jakarta) | HandlerInterceptor |
|---------|----------------------|-------------------|
| **Nivel** | Servlet container (antes de Spring) | Spring MVC (después de DispatcherServlet) |
| **Acceso a Spring beans** | Solo via `@Autowired` si es `@Component` | Directo (es un Spring bean) |
| **Conoce el handler** | No | Sí (sabe qué método del controller ejecutará) |
| **Puede modificar respuesta** | Sí (wrapper) | Limitado |
| **Uso típico** | CORS, compresión, logging de request/response raw, auth general | Logging por controller, auth específica de MVC, métricas por endpoint |

```java
// Filter: se ejecuta para TODO, incluso errores de Spring
@Component
@Order(1)
public class RequestLoggingFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        log.info("Incoming: {} {}", request.getMethod(), request.getRequestURI());
        chain.doFilter(req, res);
    }
}

// Interceptor: solo para requests que llegan a un controller
@Component
public class AuthorizationInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (handler instanceof HandlerMethod method) {
            // puedo inspeccionar anotaciones del método del controller
            RequiresAdmin annotation = method.getMethodAnnotation(RequiresAdmin.class);
            if (annotation != null && !isAdmin()) {
                response.setStatus(403);
                return false; // aborta la request
            }
        }
        return true;
    }
}

// Registrar el interceptor
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
            .addPathPatterns("/api/admin/**")
            .excludePathPatterns("/api/auth/**");
    }
}
```

**Curiosidad de examen**: `postHandle()` del Interceptor **NO se llama** si el handler lanzó una excepción. `afterCompletion()` SÍ se llama siempre (incluso con excepción), por eso se usa para cleanup.

---

## 4. Spring Data JPA

### Jerarquía de Repositorios

```
Repository (marker interface vacía)
    └── CrudRepository<T, ID>         → save, findById, findAll, delete, count
            └── PagingAndSortingRepository<T, ID>  → findAll(Pageable), findAll(Sort)
                    └── JpaRepository<T, ID>       → flush, saveAndFlush, deleteInBatch, getOne
```

**CrudRepository** para operaciones básicas sin paginación.
**JpaRepository** para la mayoría de casos — incluye todo lo anterior + batch operations + flush control.

### Formas de definir queries

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    // 1. Derived query (Spring genera el JPQL del nombre del método)
    // Genera: SELECT o FROM Order o WHERE o.status = ?1 AND o.createdAt > ?2
    List<Order> findByStatusAndCreatedAtAfter(OrderStatus status, LocalDateTime date);

    // 2. JPQL con @Query
    @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.customerId = :customerId")
    List<Order> findWithItemsByCustomerId(@Param("customerId") Long customerId);

    // 3. SQL nativo (cuidado: atado a la BD, no portátil)
    @Query(value = "SELECT * FROM orders WHERE total > :amount ORDER BY created_at DESC",
           nativeQuery = true)
    List<Order> findExpensiveOrders(@Param("amount") BigDecimal amount);

    // 4. Modificación (requiere @Modifying)
    @Modifying
    @Transactional
    @Query("UPDATE Order o SET o.status = :status WHERE o.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") OrderStatus status);

    // 5. Paginación
    Page<Order> findByCustomerId(Long customerId, Pageable pageable);

    // 6. Exists
    boolean existsByCustomerEmailAndStatus(String email, OrderStatus status);

    // 7. Count
    long countByStatus(OrderStatus status);
}
```

### El Problema N+1 (el más preguntado en entrevistas JPA)

**¿Qué es?**: Si tienes 1 query para traer N órdenes, y luego N queries para traer los items de cada orden = N+1 queries totales.

```java
// Setup: Order tiene List<OrderItem> con FetchType.LAZY (default en @OneToMany)
List<Order> orders = orderRepository.findAll(); // 1 query: SELECT * FROM orders

// PROBLEMA: cada .getItems() dispara 1 query adicional
for (Order order : orders) {
    System.out.println(order.getItems().size()); // SELECT * FROM order_items WHERE order_id = ?
}
// Si hay 100 órdenes = 101 queries totales (el N+1 problem)
```

**Por qué ocurre**: El default de `@OneToMany` y `@ManyToMany` es `FetchType.LAZY` — no carga los hijos hasta que los accedes.

**Soluciones**:

```java
// SOLUCIÓN 1: JOIN FETCH en JPQL (la más común)
@Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.items")
List<Order> findAllWithItems();
// DISTINCT es necesario para evitar duplicados por el JOIN

// SOLUCIÓN 2: @EntityGraph (más declarativo)
@EntityGraph(attributePaths = {"items", "customer"})
List<Order> findAll(); // Spring agrega el JOIN FETCH automáticamente

// SOLUCIÓN 3: @BatchSize (carga lazy pero en batches)
@Entity
public class Order {
    @OneToMany(mappedBy = "order", fetch = FetchType.LAZY)
    @BatchSize(size = 25) // carga items en grupos de 25
    private List<OrderItem> items;
}
// Resultado: en vez de N+1 queries, hace ceil(N/25)+1 queries

// SOLUCIÓN 4: hibernate.default_batch_fetch_size (global)
// application.properties:
// spring.jpa.properties.hibernate.default_batch_fetch_size=25
```

**Cuándo NO usar JOIN FETCH**:
- Cuando tienes múltiples colecciones `@OneToMany` — Hibernate lanza `MultipleBagFetchException`
- Para paginación — los resultados se paginan en memoria, no en BD (Hibernate warning: `HHH90003004`)

**Para paginación con colecciones, usa `@EntityGraph` + paginación en dos queries**:
```java
// Query 1: obtener IDs paginados
Page<Long> ids = orderRepo.findIds(pageable);

// Query 2: cargar con sus colecciones
List<Order> orders = orderRepo.findByIdInWithItems(ids.getContent());
```

### Transacciones

#### Propagación (muy preguntado)

```java
@Service
public class OuterService {
    @Autowired InnerService inner;

    @Transactional  // Tx A
    public void outer() {
        // REQUIRED: inner.method() usa Tx A
        // REQUIRES_NEW: inner.method() crea Tx B, suspende Tx A
        // NESTED: inner.method() crea savepoint dentro de Tx A
        // SUPPORTS: inner.method() usa Tx A (si no hubiera Tx, sin tx)
        // NOT_SUPPORTED: inner.method() suspende Tx A, ejecuta sin tx
        // NEVER: lanza excepción porque hay Tx A activa
        // MANDATORY: usa Tx A (si no hubiera Tx, lanza excepción)
        inner.method();
    }
}
```

| Propagación | Hay Tx activa | No hay Tx activa |
|-------------|--------------|-----------------|
| `REQUIRED` (default) | Usa la existente | Crea nueva |
| `REQUIRES_NEW` | Crea nueva, suspende la existente | Crea nueva |
| `NESTED` | Crea savepoint dentro de la existente | Crea nueva |
| `SUPPORTS` | Usa la existente | Sin transacción |
| `NOT_SUPPORTED` | Suspende la existente | Sin transacción |
| `MANDATORY` | Usa la existente | Lanza excepción |
| `NEVER` | Lanza excepción | Sin transacción |

**Caso práctico de REQUIRES_NEW**:
```java
@Service
public class AuditService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAction(String action) {
        // Siempre graba el audit, incluso si el outer falla
        auditRepo.save(new AuditLog(action));
    }
}

@Service
public class OrderService {
    @Transactional
    public void processOrder(Order order) {
        orderRepo.save(order);
        auditService.logAction("ORDER_CREATED"); // tx propia, no se revierte si outer falla
        throw new RuntimeException("Fallo!"); // order se revierte, pero audit queda grabado
    }
}
```

#### Niveles de Aislamiento

| Nivel | Dirty Read | Non-Repeatable Read | Phantom Read | Rendimiento |
|-------|-----------|--------------------|--------------| ------------|
| `READ_UNCOMMITTED` | ✅ posible | ✅ posible | ✅ posible | Máximo |
| `READ_COMMITTED` | ❌ protegido | ✅ posible | ✅ posible | Alto (default en PostgreSQL/Oracle) |
| `REPEATABLE_READ` | ❌ protegido | ❌ protegido | ✅ posible | Medio (default en MySQL) |
| `SERIALIZABLE` | ❌ protegido | ❌ protegido | ❌ protegido | Mínimo |

- **Dirty Read**: lees datos que otra transacción escribió pero aún no confirmó (y puede hacer rollback)
- **Non-Repeatable Read**: lees la misma fila dos veces y obtienes valores distintos (otra tx la modificó entre medio)
- **Phantom Read**: ejecutas la misma query dos veces y obtienes filas distintas (otra tx insertó/eliminó)

#### La Trampa Más Famosa: Self-Invocation

```java
@Service
public class OrderService {

    public void processOrders(List<Long> ids) {
        ids.forEach(id -> this.createOrder(id)); // llama a createOrder directamente
    }

    @Transactional  // NO FUNCIONA cuando se llama desde arriba
    public void createOrder(Long id) {
        // Spring usa un proxy para @Transactional
        // cuando llamas this.createOrder(), llamas al objeto real, NO al proxy
        // → la transacción no se activa
    }
}
```

**Por qué ocurre**: Spring AOP usa proxies. El proxy intercepta llamadas externas al bean y aplica el comportamiento transaccional. Las llamadas `this.xxx()` van directo al objeto real, bypaseando el proxy.

**Soluciones**:
```java
// Opción 1: inyectar el bean en sí mismo (feo pero funciona)
@Service
public class OrderService {
    @Autowired
    private OrderService self; // Spring inyecta el proxy

    public void processOrders(List<Long> ids) {
        ids.forEach(id -> self.createOrder(id)); // ahora pasa por el proxy
    }
}

// Opción 2: extraer a otro bean (la mejor solución)
@Service
public class OrderCreationService {
    @Transactional
    public void createOrder(Long id) { /* ... */ }
}

// Opción 3: usar AopContext (requiere exposeProxy=true)
@SpringBootApplication
@EnableAspectJAutoProxy(exposeProxy = true)
public class App {}

public void processOrders() {
    ((OrderService) AopContext.currentProxy()).createOrder(id);
}
```

### Proyecciones

**¿Por qué usarlas?**: En vez de traer la entidad completa (con todos sus campos y relaciones), traes solo los datos que necesitas → menos memoria, queries más rápidas, mejor encapsulación.

```java
// 1. Interface projection (Spring genera proxy en runtime)
public interface OrderSummary {
    Long getId();
    String getStatus();
    BigDecimal getTotal();
    // Spring genera: SELECT o.id, o.status, o.total FROM orders o
}

List<OrderSummary> findByCustomerId(Long customerId);

// 2. Closed projection con SpEL
public interface FullName {
    @Value("#{target.firstName + ' ' + target.lastName}")
    String getFullName(); // campo calculado, Spring necesita cargar toda la entidad
}

// 3. DTO projection (más eficiente que interface para joins complejos)
public record OrderDto(Long id, String status, BigDecimal total) {}

@Query("SELECT new com.example.dto.OrderDto(o.id, o.status, o.total) FROM Order o WHERE o.customerId = :id")
List<OrderDto> findDtosByCustomerId(@Param("id") Long customerId);

// 4. Dynamic projection (el caller decide el tipo)
<T> List<T> findByCustomerId(Long customerId, Class<T> type);

// Uso:
List<OrderSummary> summaries = repo.findByCustomerId(1L, OrderSummary.class);
List<OrderDto> dtos = repo.findByCustomerId(1L, OrderDto.class);
```

**Interface projection vs DTO projection**:
- Interface projection: Spring genera SQL optimizado automáticamente, pero para SpEL carga la entidad completa.
- DTO projection con `new`: siempre eficiente, pero requiere query manual.

---

## 5. Spring Security

### Arquitectura de Seguridad

```
HTTP Request
    ↓
FilterChainProxy (DelegatingFilterProxy → Spring)
    ↓
SecurityFilterChain (lista de filtros configurables)
    ├── SecurityContextPersistenceFilter (carga SecurityContext de sesión)
    ├── UsernamePasswordAuthenticationFilter (login form)
    ├── BearerTokenAuthenticationFilter (JWT)
    ├── BasicAuthenticationFilter (Basic Auth)
    └── ... otros filtros ...
    ↓
AuthenticationManager
    ↓ delega a
AuthenticationProvider (ej: DaoAuthenticationProvider)
    ↓ usa
UserDetailsService.loadUserByUsername(username)
    ↓ retorna UserDetails
    ↓ verifica password con PasswordEncoder
    ↓
Authentication token guardado en SecurityContextHolder
    ↓
Request continúa al Controller
```

**SecurityContextHolder**: thread-local que almacena el `Authentication` del usuario actual. Por default usa `ThreadLocal` — en aplicaciones reactivas necesitas `ReactiveSecurityContextHolder`.

### Configuración Moderna (Spring Security 6+)

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // activa @PreAuthorize, @PostAuthorize, etc.
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            // Deshabilitar CSRF para APIs REST stateless
            // (CSRF protege contra formularios en sesiones, no aplica a JWT)
            .csrf(AbstractHttpConfigurer::disable)

            // Stateless: no crear sesiones HTTP
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // Reglas de autorización
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/actuator/health").permitAll()
                .requestMatchers("/actuator/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/products/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/admin/**").hasAuthority("PERMISSION_ADMIN_WRITE")
                .anyRequest().authenticated())

            // Agregar filtro JWT antes del filtro de autenticación por usuario/contraseña
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

            // Manejo de excepciones de seguridad
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(/* 401 handler */)
                .accessDeniedHandler(/* 403 handler */))

            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12); // 12 rounds de hashing
    }

    @Bean
    public AuthenticationManager authManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
```

**hasRole vs hasAuthority**:
- `hasRole("ADMIN")` busca la authority `ROLE_ADMIN` (agrega el prefijo automáticamente)
- `hasAuthority("ROLE_ADMIN")` busca exactamente esa cadena
- Por convención, los roles tienen prefijo `ROLE_`, los permisos no

### Implementación JWT Completa

```java
// Servicio JWT
@Service
public class JwtService {
    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration:86400000}") // 24h default
    private long expiration;

    public String generateToken(UserDetails userDetails) {
        return Jwts.builder()
            .subject(userDetails.getUsername())
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration))
            .claim("roles", userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority).toList())
            .signWith(getSigningKey())
            .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    }
}

// Filtro JWT
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws IOException, ServletException {
        String authHeader = request.getHeader("Authorization");

        // Si no hay Bearer token, continuar sin autenticar
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        String username = jwtService.extractUsername(token);

        // Solo autenticar si hay username y aún no está autenticado
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);

            if (jwtService.isTokenValid(token, userDetails)) {
                UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        chain.doFilter(request, response);
    }
}
```

**Por qué `OncePerRequestFilter`**: Garantiza que el filtro se ejecuta exactamente una vez por request, incluso en casos de forward/include en Servlet.

### Seguridad a Nivel de Método

```java
@Service
public class OrderService {

    // Solo ADMIN o el usuario dueño del recurso puede ver sus órdenes
    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
    public List<Order> findByUser(Long userId) { /* ... */ }

    // Se ejecuta el método y LUEGO verifica si puede retornar el resultado
    @PostAuthorize("returnObject.userId == authentication.principal.id")
    public Order findById(Long id) { /* ... */ }

    // Filtra la colección de entrada
    @PreFilter("filterObject.userId == authentication.principal.id")
    public void deleteOrders(List<Order> orders) { /* ... */ }

    // Filtra la colección de salida
    @PostFilter("filterObject.userId == authentication.principal.id")
    public List<Order> findAll() { /* ... */ }

    // Con SpEL más complejo
    @PreAuthorize("@orderSecurityService.canModify(authentication, #orderId)")
    public void update(Long orderId, UpdateOrderRequest req) { /* ... */ }
}

@Service
public class OrderSecurityService {
    public boolean canModify(Authentication auth, Long orderId) {
        // lógica de autorización compleja
        return orderRepo.findById(orderId)
            .map(o -> o.getUserId().equals(((UserDetails)auth.getPrincipal()).getId()))
            .orElse(false);
    }
}
```

**Curiosidades de examen**:
- `@EnableMethodSecurity` reemplaza a `@EnableGlobalMethodSecurity` de Spring Security 5 (está deprecado).
- `@Secured` y `@RolesAllowed` son alternativas más simples a `@PreAuthorize` pero sin SpEL.
- Por default, `@PreAuthorize` en métodos de la misma clase sufre del mismo problema de self-invocation que `@Transactional` (AOP proxy).

---

## 6. Spring Boot Actuator y Observabilidad

### ¿Qué es Actuator y por qué existe?

En producción necesitas saber: ¿está viva la app? ¿usa mucha memoria? ¿qué beans hay? ¿qué propiedades cargó? Actuator expone este "estado interno" via endpoints HTTP (o JMX).

### Configuración

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env,beans,conditions,loggers,threaddump,heapdump,mappings
      base-path: /actuator
  endpoint:
    health:
      show-details: when-authorized  # never | always | when-authorized
      show-components: always
  health:
    diskspace:
      enabled: true
    db:
      enabled: true
  server:
    port: 8081  # puerto separado para actuator (buena práctica de seguridad)
```

### Endpoints Principales

| Endpoint | Método | Qué muestra |
|----------|--------|-------------|
| `/actuator/health` | GET | Estado: UP/DOWN + componentes (DB, Redis, etc.) |
| `/actuator/info` | GET | Versión, git commit, info custom |
| `/actuator/metrics` | GET | Lista de métricas disponibles |
| `/actuator/metrics/{name}` | GET | Valor de una métrica específica |
| `/actuator/env` | GET | Properties, variables de entorno |
| `/actuator/beans` | GET | Todos los beans del contexto |
| `/actuator/conditions` | GET | Reporte de auto-configuration |
| `/actuator/mappings` | GET | Todos los endpoints HTTP registrados |
| `/actuator/loggers` | GET/POST | Ver y cambiar nivel de log en runtime |
| `/actuator/threaddump` | GET | Estado de todos los threads |
| `/actuator/heapdump` | GET | Descarga heap dump (para analizar con VisualVM/MAT) |
| `/actuator/shutdown` | POST | Apagar la app (deshabilitado por default!) |

**Cambiar nivel de log en caliente** (muy útil en producción):
```bash
# Ver nivel actual del logger
GET /actuator/loggers/com.example.service

# Cambiar a DEBUG sin reiniciar
POST /actuator/loggers/com.example.service
Content-Type: application/json
{"configuredLevel": "DEBUG"}

# Volver al nivel original
POST /actuator/loggers/com.example.service
{"configuredLevel": null}
```

### Custom Health Indicator

```java
@Component
public class ExternalApiHealthIndicator implements HealthIndicator {

    private final RestTemplate restTemplate;
    private final String apiUrl;

    @Override
    public Health health() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(apiUrl + "/health", String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                return Health.up()
                    .withDetail("url", apiUrl)
                    .withDetail("responseTime", "fast") // puedes agregar cualquier detalle
                    .build();
            }
            return Health.down()
                .withDetail("status", response.getStatusCode())
                .build();
        } catch (Exception ex) {
            return Health.down(ex)
                .withDetail("url", apiUrl)
                .build();
        }
    }
}
```

**Resultado en `/actuator/health`**:
```json
{
  "status": "UP",
  "components": {
    "db": { "status": "UP", "details": { "database": "PostgreSQL" } },
    "externalApi": { "status": "UP", "details": { "url": "https://api.external.com" } },
    "diskSpace": { "status": "UP", "details": { "total": 500GB, "free": 400GB } }
  }
}
```

### Métricas con Micrometer

**Micrometer** = facade de métricas (como SLF4J pero para métricas). Escribe código una vez, exporta a Prometheus, Datadog, CloudWatch, etc.

```java
@Service
public class OrderService {

    private final Counter orderCounter;
    private final Counter failedOrderCounter;
    private final Timer orderTimer;
    private final DistributionSummary orderAmountSummary;

    public OrderService(MeterRegistry registry) {
        // Counter: solo sube, nunca baja
        this.orderCounter = Counter.builder("orders.created")
            .tag("type", "standard")
            .description("Total orders created")
            .register(registry);

        this.failedOrderCounter = Counter.builder("orders.failed")
            .description("Total failed orders")
            .register(registry);

        // Timer: mide duración y cuenta
        this.orderTimer = Timer.builder("orders.processing.time")
            .description("Time to process an order")
            .publishPercentiles(0.5, 0.95, 0.99) // percentiles p50, p95, p99
            .register(registry);

        // DistributionSummary: distribución de valores (como amounts)
        this.orderAmountSummary = DistributionSummary.builder("orders.amount")
            .baseUnit("dollars")
            .register(registry);
    }

    public Order create(CreateOrderRequest request) {
        return orderTimer.record(() -> {
            try {
                Order order = processOrder(request);
                orderCounter.increment();
                orderAmountSummary.record(order.getTotal().doubleValue());
                return order;
            } catch (Exception e) {
                failedOrderCounter.increment();
                throw e;
            }
        });
    }
}
```

**Con anotación `@Timed`** (más simple):
```java
@Service
public class OrderService {

    @Timed(value = "orders.processing.time", description = "Order processing duration")
    public Order create(CreateOrderRequest request) {
        return processOrder(request);
    }
}
```

**Configuración para Prometheus**:
```xml
<!-- dependency -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```
```yaml
management:
  endpoints:
    web:
      exposure:
        include: prometheus
  metrics:
    tags:
      application: ${spring.application.name}  # tag en todas las métricas
```

---

## 7. Configuración y Propiedades

### @Value vs @ConfigurationProperties

**@Value**: para propiedades simples, aisladas
```java
@Service
public class EmailService {
    @Value("${smtp.host}")
    private String host;

    @Value("${smtp.port:587}") // 587 es el default
    private int port;

    @Value("${smtp.enabled:true}")
    private boolean enabled;
}
```

**Problemas de @Value**:
- No soporta validación Bean Validation
- No hay tipado (el String del yml se convierte en runtime, errores tardíos)
- Difícil de refactorizar (strings mágicos dispersos)
- No funciona en constructores de @Configuration sin tricks

**@ConfigurationProperties**: para grupos de propiedades relacionadas
```java
@ConfigurationProperties(prefix = "app.payment")
@Validated  // activa Bean Validation en las propiedades
public record PaymentProperties(
    @NotBlank String apiUrl,
    @NotNull @Positive Duration timeout,
    @Min(1) @Max(10) int maxRetries,
    @Valid RetryConfig retry
) {
    public record RetryConfig(
        @Min(1) @Max(10) int maxAttempts,
        @NotNull Duration delay
    ) {}
}
```

```yaml
app:
  payment:
    api-url: https://api.payment.com   # kebab-case → camelCase automático
    timeout: 30s                        # Duration se parsea automáticamente
    max-retries: 3
    retry:
      max-attempts: 3
      delay: 1s
```

**Activación**:
```java
@Configuration
@EnableConfigurationProperties(PaymentProperties.class)
public class PaymentConfig {}

// O en Spring Boot 3 más simple:
@ConfigurationProperties(prefix = "app.payment")
@Validated
public record PaymentProperties(...) {} // + @Component o @EnableConfigurationProperties
```

### Orden de Precedencia de Propiedades (de mayor a menor)

1. **Argumentos de línea de comando**: `--server.port=8081`
2. **SPRING_APPLICATION_JSON** (variable de entorno con JSON)
3. **Variables de entorno del SO**: `SERVER_PORT=8081` (Spring convierte _ a . y lowercase)
4. **`application-{profile}.properties/yml`** en directorio actual
5. **`application.properties/yml`** en directorio actual
6. **`application-{profile}.properties/yml`** en classpath
7. **`application.properties/yml`** en classpath
8. **`@PropertySource`** en clases `@Configuration`
9. **Valores default en `@Value`**: `@Value("${port:8080}")`

**Esto significa**: puedes sobrescribir cualquier propiedad del `application.yml` con una variable de entorno. Útil en Docker/Kubernetes sin modificar el código.

```bash
# Estas dos formas son equivalentes para Spring Boot:
export SERVER_PORT=8081
java -jar app.jar --server.port=8081
```

### Spring Cloud Config / Externalized Config

```yaml
# Para apps en producción: nunca guardes secrets en application.yml
# Usa variables de entorno o un vault:
spring:
  datasource:
    password: ${DB_PASSWORD}  # viene de variable de entorno o Kubernetes Secret

  # O Spring Cloud Config Server
  config:
    import: "configserver:http://config-server:8888"
```

---

## 8. Spring AOP

### Conceptos Fundamentales

- **Aspect**: clase que encapsula lógica transversal (logging, seguridad, métricas, transacciones)
- **Advice**: QUÉ hacer (Before, After, Around, AfterReturning, AfterThrowing)
- **Pointcut**: DÓNDE aplicarlo (expresión que selecciona métodos/clases)
- **Join Point**: punto de ejecución en el programa (en Spring AOP = llamada a método)
- **Weaving**: proceso de aplicar los aspects al código (en Spring = en runtime via proxy)

**Por qué existe**: Separa concerns transversales del código de negocio. Sin AOP, tendrías logging/seguridad/transacciones mezclados en cada método.

### Tipos de Advice

```java
@Aspect
@Component
public class LoggingAspect {

    @Pointcut("execution(* com.example.service.*.*(..))")
    public void serviceLayer() {}

    // Antes de ejecutar el método
    @Before("serviceLayer()")
    public void logBefore(JoinPoint jp) {
        log.info("Calling: {} with args: {}", jp.getSignature(), jp.getArgs());
    }

    // Después de ejecutar (siempre, haya o no excepción)
    @After("serviceLayer()")
    public void logAfter(JoinPoint jp) {
        log.info("Completed: {}", jp.getSignature());
    }

    // Solo si retorna exitosamente
    @AfterReturning(pointcut = "serviceLayer()", returning = "result")
    public void logReturn(JoinPoint jp, Object result) {
        log.info("{} returned: {}", jp.getSignature(), result);
    }

    // Solo si lanza excepción
    @AfterThrowing(pointcut = "serviceLayer()", throwing = "ex")
    public void logException(JoinPoint jp, Exception ex) {
        log.error("{} threw: {}", jp.getSignature(), ex.getMessage());
    }

    // Envuelve la ejecución completa (el más poderoso)
    @Around("serviceLayer()")
    public Object measureTime(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        try {
            Object result = pjp.proceed(); // ejecuta el método original
            long elapsed = System.currentTimeMillis() - start;
            log.info("{} took {}ms", pjp.getSignature(), elapsed);
            return result;
        } catch (Exception ex) {
            log.error("{} failed after {}ms", pjp.getSignature(),
                System.currentTimeMillis() - start);
            throw ex; // siempre relanzar para no silenciar errores
        }
    }
}
```

**Orden de ejecución de múltiples Aspects**:
```
@Before (Aspect1)
  @Before (Aspect2)
    método original
  @After (Aspect2)
@After (Aspect1)
```
Para controlar el orden: `@Order(1)` en la clase del aspect (menor número = mayor prioridad).

### Expresiones Pointcut

```java
// Todos los métodos de todos los servicios
"execution(* com.example.service.*.*(..))"

// Solo métodos públicos
"execution(public * com.example..*.*(..))"

// Métodos que retornan String
"execution(String com.example..*.*(..))"

// Métodos con un parámetro de tipo Long
"execution(* com.example..*.*(Long))"

// Métodos anotados con @Transactional
"@annotation(org.springframework.transaction.annotation.Transactional)"

// Clases anotadas con @Service
"@within(org.springframework.stereotype.Service)"

// Combinaciones
"execution(* com.example.service.*.*(..)) && !execution(* com.example.service.*.find*(..))"
```

### JDK Proxy vs CGLIB

Spring usa proxies para implementar AOP. Hay dos tipos:

**JDK Dynamic Proxy**:
- Solo funciona si el bean implementa **interfaces**
- El proxy implementa la misma interfaz
- Spring crea `Proxy.newProxyInstance(...)` en runtime

**CGLIB Proxy**:
- Funciona con **clases concretas** (sin interfaces)
- Crea una **subclase** de tu clase en runtime
- Por eso las clases no pueden ser `final` (no se puede subclasear)
- Por eso los métodos no pueden ser `final` (no se puede sobrescribir)

```java
// Forzar CGLIB incluso cuando hay interfaces:
@EnableAspectJAutoProxy(proxyTargetClass = true)

// Spring Boot usa CGLIB por default desde 2.x
```

**Limitaciones importantes**:
1. Self-invocation no pasa por el proxy
2. Métodos `private` no interceptables
3. Clases `final` no pueden ser proxiadas por CGLIB
4. Métodos `final` no pueden ser sobrescritos por CGLIB
5. Solo intercepta llamadas a métodos, no acceso a campos

---

## 9. Spring Cache

### Cómo funciona

`@Cacheable` envuelve el método con un proxy AOP. Antes de ejecutar, busca el resultado en el cache. Si existe, lo retorna sin ejecutar el método. Si no existe, ejecuta el método y guarda el resultado.

```java
@Configuration
@EnableCaching  // activa el soporte de caché
public class CacheConfig {

    // Cache en memoria simple (no para producción con múltiples instancias)
    @Bean
    public CacheManager cacheManager() {
        ConcurrentMapCacheManager manager = new ConcurrentMapCacheManager("products", "users");
        return manager;
    }
}

// Con Redis (para producción y múltiples instancias)
@Bean
public CacheManager redisCacheManager(RedisConnectionFactory factory) {
    RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
        .entryTtl(Duration.ofMinutes(30))
        .disableCachingNullValues()
        .serializeKeysWith(RedisSerializationContext.SerializationPair
            .fromSerializer(new StringRedisSerializer()))
        .serializeValuesWith(RedisSerializationContext.SerializationPair
            .fromSerializer(new GenericJackson2JsonRedisSerializer()));

    // Configuración por cache individual
    Map<String, RedisCacheConfiguration> cacheConfigs = Map.of(
        "products", defaultConfig.entryTtl(Duration.ofHours(1)),
        "users", defaultConfig.entryTtl(Duration.ofMinutes(5))
    );

    return RedisCacheManager.builder(factory)
        .cacheDefaults(defaultConfig)
        .withInitialCacheConfigurations(cacheConfigs)
        .build();
}
```

### Anotaciones de Caché

```java
@Service
public class ProductService {

    // Lee del caché. Si no existe, ejecuta el método y almacena el resultado
    @Cacheable(value = "products", key = "#id")
    public Product findById(Long id) {
        return repo.findById(id).orElseThrow();
    }

    // No almacena si el resultado es null
    @Cacheable(value = "products", key = "#id", unless = "#result == null")
    public Product findByIdNullable(Long id) {
        return repo.findById(id).orElse(null);
    }

    // Actualiza el caché (siempre ejecuta el método Y actualiza el caché)
    @CachePut(value = "products", key = "#result.id")
    public Product save(Product product) {
        return repo.save(product);
    }

    // Elimina entrada del caché
    @CacheEvict(value = "products", key = "#id")
    public void delete(Long id) {
        repo.deleteById(id);
    }

    // Elimina todas las entradas del caché
    @CacheEvict(value = "products", allEntries = true)
    public void deleteAll() {
        repo.deleteAll();
    }

    // Múltiples operaciones de caché
    @Caching(
        evict = {
            @CacheEvict(value = "products", key = "#product.id"),
            @CacheEvict(value = "productsByCategory", key = "#product.categoryId")
        },
        put = { @CachePut(value = "products", key = "#result.id") }
    )
    public Product update(Product product) {
        return repo.save(product);
    }

    // Condición para cachear
    @Cacheable(value = "products", key = "#id", condition = "#id > 0")
    public Product findByIdConditional(Long id) {
        return repo.findById(id).orElseThrow();
    }
}
```

**Diferencia @Cacheable vs @CachePut**:
- `@Cacheable`: si ya está en caché, retorna el caché **sin ejecutar el método**
- `@CachePut`: **siempre ejecuta el método** y actualiza el caché con el resultado

**Cuándo NO usar caché**:
- Datos que cambian con alta frecuencia
- Datos únicos por usuario (sin TTL adecuado → memory leak)
- Datos de seguridad críticos (permisos, tokens revocados)
- Múltiples instancias sin caché distribuido (ConcurrentMapCache no se sincroniza)

**Trampa de self-invocation**: Como AOP, `@Cacheable` no funciona en llamadas internas.

---

## 10. Spring Events

### Por qué existe

Desacopla componentes: el que publica un evento no sabe quién lo escucha. Ej: cuando se crea una orden, el `OrderService` no debería saber sobre `EmailService`, `AuditService`, `InventoryService`.

### Eventos Síncronos (mismo thread, misma transacción)

```java
// Definir el evento (simple record en Spring 6+)
public record OrderCreatedEvent(Order order, Instant occurredAt) {}

// Publicar
@Service
@RequiredArgsConstructor
public class OrderService {
    private final ApplicationEventPublisher publisher;

    @Transactional
    public Order create(CreateOrderRequest req) {
        Order order = orderRepo.save(new Order(req));
        publisher.publishEvent(new OrderCreatedEvent(order, Instant.now()));
        // El listener se ejecuta AQUÍ, síncronamente, dentro de la misma transacción
        return order;
    }
}

// Escuchar
@Component
public class OrderCreatedListener {
    @EventListener
    public void handle(OrderCreatedEvent event) {
        // Cuidado: si esto falla, rollbackea toda la transacción del publisher
        auditRepo.save(new AuditLog(event));
    }
}
```

### @TransactionalEventListener (el más importante en producción)

**Problema**: Si el listener síncrono envía un email y luego la transacción hace rollback, el email ya fue enviado pero la orden no existe en BD.

```java
@Component
public class OrderNotificationListener {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderCreated(OrderCreatedEvent event) {
        // Solo se ejecuta si la transacción se commitó exitosamente
        emailService.sendConfirmation(event.order());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
    public void onOrderFailed(OrderCreatedEvent event) {
        // Solo si la transacción falló
        alertingService.notifyFailure(event);
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void beforeCommit(OrderCreatedEvent event) {
        // Antes de commitear — puede lanzar excepción para abortar
        validateInventory(event.order());
    }
}
```

**Fases disponibles**:
- `BEFORE_COMMIT`: antes del commit (puede abortar)
- `AFTER_COMMIT` (default): después del commit exitoso
- `AFTER_ROLLBACK`: después del rollback
- `AFTER_COMPLETION`: después de commit O rollback (siempre)

### @Async con Eventos

```java
@Component
public class SlowNotificationListener {

    @EventListener
    @Async("notificationExecutor") // ejecutar en thread pool dedicado
    public void sendPushNotification(OrderCreatedEvent event) {
        // No bloquea el thread del OrderService
        pushService.send(event.order().getUserId(), "Tu orden fue creada");
    }
}

// Configurar el executor
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean("notificationExecutor")
    public Executor notificationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("notif-");
        executor.initialize();
        return executor;
    }
}
```

**Curiosidad de examen**: `@TransactionalEventListener` + `@Async` tiene un comportamiento especial. El `@Async` se ejecuta después de que el `AFTER_COMMIT` se dispare, en el thread pool configurado.

---

## 11. Testing en Spring Boot

### Pirámide de Testing

```
        /\
       /  \   E2E Tests (pocos, lentos, frágiles)
      /----\
     /      \  Integration Tests (@SpringBootTest)
    /--------\
   /          \  Slice Tests (@WebMvcTest, @DataJpaTest)
  /------------\
 /              \ Unit Tests (muchos, rápidos, @ExtendWith(MockitoExtension.class))
```

### Unit Tests (sin Spring)

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    OrderRepository repository;

    @Mock
    PaymentService paymentService;

    @InjectMocks
    OrderService service; // crea instancia real e inyecta los mocks

    @Test
    void shouldCreateOrder_whenValidRequest() {
        // Given
        CreateOrderRequest request = new CreateOrderRequest("email@test.com", BigDecimal.TEN, List.of());
        Order savedOrder = new Order(1L, "email@test.com", OrderStatus.PENDING);
        when(repository.save(any(Order.class))).thenReturn(savedOrder);
        when(paymentService.charge(any())).thenReturn(new PaymentResult("APPROVED"));

        // When
        Order result = service.create(request);

        // Then
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getStatus()).isEqualTo(OrderStatus.PENDING);
        verify(repository).save(any(Order.class));
        verify(paymentService).charge(any());
    }

    @Test
    void shouldThrowException_whenPaymentFails() {
        when(paymentService.charge(any())).thenThrow(new PaymentException("Insufficient funds"));
        assertThatThrownBy(() -> service.create(request))
            .isInstanceOf(OrderException.class)
            .hasMessageContaining("Payment failed");
    }
}
```

### Slice Tests (@WebMvcTest)

Solo carga la capa web: controllers, filters, interceptors. NO carga la BD, servicios reales, etc.

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean  // reemplaza el bean real en el contexto de Spring
    OrderService orderService;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    @WithMockUser(roles = "USER")  // simula usuario autenticado
    void shouldReturnOrder_whenExists() throws Exception {
        Order order = new Order(1L, "email@test.com", OrderStatus.PENDING);
        when(orderService.findById(1L)).thenReturn(order);

        mockMvc.perform(get("/api/orders/1")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andDo(print()); // imprime request/response en los logs
    }

    @Test
    void shouldReturn401_whenNotAuthenticated() throws Exception {
        mockMvc.perform(get("/api/orders/1"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void shouldReturn400_whenInvalidBody() throws Exception {
        CreateOrderRequest invalid = new CreateOrderRequest("", null, List.of());

        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalid)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors").isArray());
    }
}
```

### Slice Tests (@DataJpaTest)

Solo carga la capa de datos: JPA, Hibernate, repositorios. Por default usa H2 en memoria.

```java
@DataJpaTest
class OrderRepositoryTest {

    @Autowired
    TestEntityManager em; // para setup sin usar el repositorio bajo test

    @Autowired
    OrderRepository repository;

    @Test
    void shouldFindPendingOrders() {
        // Setup
        Order pending = em.persist(new Order("email@test.com", OrderStatus.PENDING, BigDecimal.TEN));
        Order completed = em.persist(new Order("email2@test.com", OrderStatus.COMPLETED, BigDecimal.ONE));
        em.flush();

        // When
        List<Order> result = repository.findByStatus(OrderStatus.PENDING);

        // Then
        assertThat(result).hasSize(1).contains(pending);
    }

    @Test
    void shouldUpdateStatusWithCustomQuery() {
        Order order = em.persist(new Order("email@test.com", OrderStatus.PENDING, BigDecimal.TEN));
        em.flush();

        int updated = repository.updateStatus(order.getId(), OrderStatus.COMPLETED);

        assertThat(updated).isEqualTo(1);
        em.clear(); // limpiar el contexto de persistencia para re-leer de BD
        assertThat(em.find(Order.class, order.getId()).getStatus())
            .isEqualTo(OrderStatus.COMPLETED);
    }
}
```

**Usar BD real en @DataJpaTest**:
```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE) // no reemplazar con H2
@ActiveProfiles("test")
class OrderRepositoryTest {}
```

### Integration Tests con TestContainers

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = Replace.NONE)
@Testcontainers
class OrderIntegrationTest {

    @Container
    @ServiceConnection // Spring Boot 3.1+ — auto-configura las propiedades
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    @ServiceConnection
    static RedisContainer redis = new RedisContainer("redis:7-alpine");

    @Autowired
    TestRestTemplate restTemplate;

    @Autowired
    OrderRepository orderRepository;

    @Test
    @Sql("/test-data/orders.sql") // ejecutar SQL antes del test
    void shouldCreateAndRetrieveOrder() {
        // Given
        CreateOrderRequest request = new CreateOrderRequest("email@test.com", BigDecimal.TEN, items);

        // When
        ResponseEntity<OrderDto> createResponse = restTemplate.postForEntity(
            "/api/orders", request, OrderDto.class);

        // Then
        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long orderId = createResponse.getBody().id();

        ResponseEntity<OrderDto> getResponse = restTemplate.getForEntity(
            "/api/orders/" + orderId, OrderDto.class);
        assertThat(getResponse.getBody().status()).isEqualTo("PENDING");
    }
}
```

**@ServiceConnection** (Spring Boot 3.1+): detecta el tipo del container y configura las propiedades automáticamente. Antes necesitabas `@DynamicPropertySource`.

### Anotaciones de Testing Útiles

| Anotación | Qué hace |
|-----------|---------|
| `@MockBean` | Reemplaza un bean en el contexto de Spring con un mock |
| `@SpyBean` | Envuelve el bean real con un spy (puedes stubear métodos específicos) |
| `@Sql` | Ejecuta SQL antes/después del test |
| `@SqlGroup` | Múltiples `@Sql` |
| `@DirtiesContext` | Reinicia el ApplicationContext después del test (lento, usar con cuidado) |
| `@TestPropertySource` | Agrega/sobreescribe propiedades para el test |
| `@ActiveProfiles` | Activa perfiles específicos |
| `@WithMockUser` | Simula usuario autenticado en tests de Spring Security |
| `@WithUserDetails` | Carga un UserDetails real para el test |
| `@Transactional` (en test) | Rollback automático después de cada test |

**@MockBean vs @Mock**:
- `@Mock` (Mockito): crea mock puro, sin Spring, rápido, para unit tests
- `@MockBean` (Spring Boot): registra el mock en el ApplicationContext, hace que Spring lo inyecte, más lento (recarga el contexto si cambia)

**Curiosidad de examen**: `@SpringBootTest` recarga el contexto para cada combinación única de configuración. Para acelerar los tests, mantén la misma configuración en todos tus tests de integración — Spring reutiliza el contexto (context caching).

---

## 12. Spring Boot con Kafka

### Conceptos Clave

- **Topic**: canal de mensajes (como una cola persistente y replayable)
- **Partition**: división del topic para paralelismo (más particiones = más consumidores en paralelo)
- **Consumer Group**: grupo de consumidores que se reparten las particiones
- **Offset**: posición del consumidor en la partición (permite replay)
- **Producer**: envía mensajes
- **Consumer**: recibe mensajes

### Configuración con Spring Boot

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      properties:
        enable.idempotence: true  # evita duplicados en caso de reintento
        acks: all                 # esperar confirmación de todos los replicas
    consumer:
      group-id: my-service
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      auto-offset-reset: earliest  # empezar desde el inicio si no hay offset guardado
      properties:
        spring.json.trusted.packages: "com.example.events"
```

### Productor

```java
@Service
@RequiredArgsConstructor
public class OrderEventProducer {
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publish(OrderCreatedEvent event) {
        // La key determina la partición → misma key siempre va a la misma partición
        // Usar el ID del recurso como key garantiza orden por recurso
        kafkaTemplate.send("orders.created", event.orderId().toString(), event)
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish event: {}", ex.getMessage());
                    // Aquí deberías tener una estrategia de retry o outbox pattern
                } else {
                    log.info("Published to topic={}, partition={}, offset={}",
                        result.getRecordMetadata().topic(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
                }
            });
    }

    // Con headers para metadata
    public void publishWithHeaders(OrderCreatedEvent event) {
        ProducerRecord<String, Object> record = new ProducerRecord<>(
            "orders.created", null, event.orderId().toString(), event);
        record.headers().add("event-type", "OrderCreated".getBytes());
        record.headers().add("correlation-id", UUID.randomUUID().toString().getBytes());
        kafkaTemplate.send(record);
    }
}
```

### Consumidor

```java
@Service
@RequiredArgsConstructor
public class OrderEventConsumer {

    @KafkaListener(
        topics = "orders.created",
        groupId = "notification-service",
        concurrency = "3"  // 3 threads paralelos (máx = número de particiones)
    )
    public void consume(
            @Payload OrderCreatedEvent event,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
            @Header(KafkaHeaders.OFFSET) long offset,
            Acknowledgment ack) {
        try {
            log.info("Processing from {}-{} at offset {}", topic, partition, offset);
            notificationService.notify(event);
            ack.acknowledge(); // commit manual del offset
        } catch (NonRetryableException e) {
            log.error("Non-retryable error, sending to DLT", e);
            ack.acknowledge(); // commit para no reprocessar
            // enviar manualmente al DLT
        } catch (Exception e) {
            log.error("Retryable error, will retry", e);
            throw e; // Spring Kafka aplicará la retry policy y luego DLT
        }
    }
}
```

### Dead Letter Topic (DLT) y Reintentos

```java
@Configuration
public class KafkaConfig {

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory(
            ConsumerFactory<String, Object> consumerFactory) {
        var factory = new ConcurrentKafkaListenerContainerFactory<String, Object>();
        factory.setConsumerFactory(consumerFactory);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);

        // Retry con backoff exponencial
        factory.setCommonErrorHandler(new DefaultErrorHandler(
            new DeadLetterPublishingRecoverer(kafkaTemplate), // envía al topic .DLT
            new FixedBackOff(1000L, 3) // 3 reintentos con 1 segundo de espera
        ));
        return factory;
    }
}
```

**Curiosidades de examen**:
- `enable.idempotence=true` garantiza que el productor no envíe duplicados en retries. Requiere `acks=all` y `max.in.flight.requests.per.connection<=5`.
- El número de consumidores en un grupo NO puede superar el número de particiones — los extras quedan ociosos.
- Kafka garantiza orden **por partición**, no por topic completo. Por eso la key es importante.
- `auto.offset.reset=earliest` lee desde el inicio si no hay offset guardado; `latest` lee solo mensajes nuevos.

---

## 13. Preguntas Trampa y Curiosidades Avanzadas

### @Transactional — Casos que fallan

```java
// FALLA 1: self-invocation
@Service
public class OrderService {
    public void process() {
        this.create(); // NO pasa por el proxy AOP
    }
    @Transactional
    public void create() { /* sin transacción */ }
}

// FALLA 2: método privado
@Service
public class OrderService {
    @Transactional
    private void create() { /* sin transacción — el proxy no puede sobrescribir métodos privados */ }
}

// FALLA 3: checked exception no hace rollback por default
@Transactional
public void create() throws IOException {
    repo.save(order);
    throw new IOException("error"); // NO hace rollback por default!
    // Necesitas: @Transactional(rollbackFor = IOException.class)
}

// FALLA 4: excepción capturada y no relanzada
@Transactional
public void create() {
    try {
        repo.save(order);
        throw new RuntimeException("error");
    } catch (Exception e) {
        log.error("error", e); // la excepción no llegó a Spring → NO hace rollback!
    }
}
```

### Diferencias entre @Component, @Service, @Repository, @Controller

**Son técnicamente lo mismo** — todas son `@Component`. Diferencias:

| Anotación | Diferencia técnica real |
|-----------|------------------------|
| `@Repository` | Activa **traducción de excepciones** de persistencia (SQLException → DataAccessException). También marcada para detección de repositorios. |
| `@Controller` | Detectada por `DispatcherServlet` para manejo de requests web. |
| `@RestController` | `@Controller` + `@ResponseBody` en cada método. |
| `@Service` | **Ninguna diferencia técnica** — solo semántica para el desarrollador. |

### Spring Bean Singleton vs Singleton Pattern GoF

**Son diferentes conceptos**:
- **Singleton GoF**: una instancia por JVM, garantizado por constructor privado.
- **Spring Singleton**: una instancia por **ApplicationContext**. Si tienes dos ApplicationContexts en la misma JVM, hay dos instancias del bean "singleton".

### BeanPostProcessor vs BeanFactoryPostProcessor

```
BeanFactoryPostProcessor: se ejecuta ANTES de que los beans sean instanciados
    → puede modificar la DEFINICIÓN del bean (BeanDefinition)
    → ej: PropertySourcesPlaceholderConfigurer (reemplaza ${...})

BeanPostProcessor: se ejecuta DESPUÉS de que el bean es instanciado
    → puede modificar el OBJETO del bean
    → ej: AutowiredAnnotationBeanPostProcessor (procesa @Autowired)
    → ej: el que crea los proxies para @Transactional y @Async
```

### @SpringBootTest vs @ContextConfiguration

- `@SpringBootTest`: levanta el contexto completo de Spring Boot (auto-configuration, component scan, etc.)
- `@ContextConfiguration`: levanta solo lo que especificas (más control, más verboso)
- `@WebMvcTest`, `@DataJpaTest`, etc.: cargan un "slice" del contexto (rápidos pero limitados)

### Lazy Initialization

```yaml
spring:
  main:
    lazy-initialization: true  # todos los beans se crean on-demand
```

**Ventaja**: arranque más rápido (útil para desarrollo y tests).
**Desventaja**: errores de configuración se detectan tarde (en runtime, no al arrancar).
**Producción**: generalmente desactivado — prefieres detectar errores al arrancar.

Para un bean específico:
```java
@Component
@Lazy  // solo este bean es lazy
public class HeavyService { ... }
```

### Circular Dependencies

```java
// Spring puede resolver con setter injection:
@Component
public class A {
    @Autowired
    private B b; // B tiene A, A tiene B → circular!
}

// Con constructor injection, Spring FALLA al arrancar con BeanCurrentlyInCreationException
// Esto es BUENO — te obliga a romper el ciclo rediseñando

// Con setter injection (Spring Boot < 2.6), Spring lo resuelve creando A sin B, luego inyectando B
```

Spring Boot 2.6+ prohíbe dependencias circulares por default. Para forzarlas:
```yaml
spring:
  main:
    allow-circular-references: true  # no recomendado
```

### SpEL (Spring Expression Language) — Capacidades Avanzadas

```java
// En @Value
@Value("#{systemProperties['user.home']}")  // propiedad del sistema
@Value("#{T(java.lang.Math).random() * 100}") // método estático
@Value("#{userService.defaultUser.email}") // propiedad de otro bean

// En @PreAuthorize
@PreAuthorize("T(java.time.LocalTime).now().getHour() between 8 and 18") // solo en horario laboral
@PreAuthorize("authentication.principal.accountNonLocked and hasRole('USER')")

// En @Cacheable
@Cacheable(key = "#root.method.name + '_' + #id") // key con nombre del método
@Cacheable(key = "#root.targetClass.simpleName + ':' + #id")
```

### Graceful Shutdown

```yaml
server:
  shutdown: graceful  # en vez de immediate
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s  # espera hasta 30s que los requests activos terminen
```

**Qué hace**: al recibir SIGTERM (ej: kubectl rollout), el servidor deja de aceptar nuevos requests pero espera que los actuales terminen antes de cerrar.

**Sin graceful shutdown**: los requests en vuelo reciben un error de conexión.

### HikariCP - Pool de Conexiones

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10       # máximo de conexiones (depende del servidor de BD)
      minimum-idle: 5             # mínimo de conexiones idle
      connection-timeout: 30000   # ms para obtener una conexión del pool
      idle-timeout: 600000        # ms antes de cerrar conexión idle
      max-lifetime: 1800000       # ms de vida máxima de una conexión (siempre < wait_timeout de MySQL)
      pool-name: MyHikariPool
      leak-detection-threshold: 60000  # detecta conexiones no cerradas
```

**Regla del tamaño del pool (Hikari docs)**:
`pool size = Tn * (Cm - 1) + 1`
donde Tn = número de threads, Cm = número máximo de conexiones concurrentes por thread.

Para la mayoría de aplicaciones: `maximum-pool-size = número de CPUs * 2` es un buen punto de partida.

### @Async — Detalles Internos

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) -> log.error("Async exception in {}: {}", method, ex.getMessage());
    }
}
```

**Importante**: métodos `@Async` que retornan `Future` o `CompletableFuture` propagan las excepciones. Métodos `@Async` que retornan `void` lanzan las excepciones silenciosamente — necesitas el `AsyncUncaughtExceptionHandler`.

### Outbox Pattern con Spring

El problema: publicar un evento a Kafka Y guardar en BD de forma atómica.

```java
// Anti-patrón: no atómico
@Transactional
public Order create(CreateOrderRequest req) {
    Order order = orderRepo.save(new Order(req)); // si esto Ok...
    kafkaTemplate.send("orders", event);          // ...y esto falla, BD y Kafka inconsistentes
    return order;
}

// Outbox pattern: guardar en BD, procesar asíncronamente
@Transactional
public Order create(CreateOrderRequest req) {
    Order order = orderRepo.save(new Order(req));
    // Guardar el evento en una tabla "outbox" en la MISMA transacción
    outboxRepo.save(new OutboxEvent("ORDER_CREATED", objectMapper.writeValueAsString(event)));
    return order;
    // Un proceso separado lee la tabla outbox y publica a Kafka
}
```

---

## Tips Senior para la Entrevista

### Cómo responder como senior

**Mal**: "Uso @Transactional para hacer transacciones"
**Bien**: "Uso @Transactional en la capa de servicio con propagation REQUIRED por default. Sé que no funciona en self-invocations porque Spring usa proxies AOP. En producción tengo cuidado con los niveles de isolation — normalmente READ_COMMITTED es suficiente. Y @Transactional no hace rollback en checked exceptions por default, lo que es una trampa común."

### Trade-offs que siempre debes mencionar

- **Lazy loading**: evita traer datos innecesarios, pero puede causar `LazyInitializationException` fuera de la sesión.
- **Caché**: mejora el rendimiento, pero añade complejidad de invalidación y puede servir datos stale.
- **@Async**: desacopla y mejora throughput, pero complica el manejo de errores y el contexto de seguridad.
- **JWT stateless**: escalable fácilmente, pero no puedes revocar tokens antes del vencimiento sin infraestructura adicional (blacklist, Redis).
- **EAGER fetch**: conveniente, pero genera JOINs automáticos que pueden ser innecesarios y costosos.

### Preguntas difíciles frecuentes y sus respuestas

**¿Cómo manejarías un pico de tráfico en tu API Spring Boot?**
"HikariCP pool bien configurado, caching con Redis, paginación en todos los endpoints de lista, @Async para operaciones no críticas, Circuit Breaker con Resilience4j para servicios externos, y horizontal scaling con load balancer. Para Kafka, aumentaría las particiones y el `concurrency` del listener."

**¿Cómo debuggeas una LazyInitializationException en producción?**
"Primero verifico que no esté accediendo a la colección lazy fuera de una sesión JPA — típicamente en el controller o después de que la sesión se cerró. Soluciones: usar DTOs/proyecciones para traer solo lo necesario, añadir `JOIN FETCH` en la query, usar `@EntityGraph`, o habilitar `Open Session in View` (pero esto último no lo recomiendo en producción por el anti-patrón que representa)."

**¿Por qué no usar @Transactional en el controller?**
"Las transacciones deberían pertenecer a la capa de negocio (service). Si el controller tiene la transacción, la conexión a BD está abierta durante todo el tiempo que Spring MVC procesa la request, incluyendo la serialización JSON — innecesariamente larga. Además, viola la separación de concerns."
