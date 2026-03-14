---
title: "Plan de Estudio - Entrevista Spring Boot Senior"
description: "Plan de estudio intensivo de Spring Boot para entrevistas senior en 1 día."
tags: ["spring-boot", "senior", "plan-estudio"]
date: "2024-01-01"
---

# Plan de Estudio - Entrevista Spring Boot Senior

> Fecha de entrevista: mañana | Tiempo disponible: ~1 dia

---

## Prioridad ALTA - Dominar estos temas si o si

### 1. Spring Core - IoC y DI

#### Contenedor y Beans
- `BeanFactory` vs `ApplicationContext` - diferencias y cuando usar cada uno
- `AnnotationConfigApplicationContext` vs `ClassPathXmlApplicationContext`
- Ciclo de vida completo de un Bean:
  1. Instanciacion
  2. Inyeccion de dependencias
  3. `@PostConstruct` / `InitializingBean.afterPropertiesSet()`
  4. Bean listo para usar
  5. `@PreDestroy` / `DisposableBean.destroy()`

```java
@Component
public class MyBean implements InitializingBean, DisposableBean {

    @PostConstruct
    public void postConstruct() { /* se ejecuta primero */ }

    @Override
    public void afterPropertiesSet() { /* se ejecuta segundo */ }

    @PreDestroy
    public void preDestroy() { /* se ejecuta primero al destruir */ }

    @Override
    public void destroy() { /* se ejecuta segundo al destruir */ }
}
```

#### Scopes
| Scope | Descripcion | Uso tipico |
|-------|-------------|-----------|
| `singleton` | Una instancia por contexto (default) | Servicios, repositorios |
| `prototype` | Nueva instancia por cada solicitud | Objetos con estado |
| `request` | Una por peticion HTTP | Web apps |
| `session` | Una por sesion HTTP | Carrito de compras |
| `application` | Una por ServletContext | Configuracion global |
| `websocket` | Una por sesion WebSocket | Aplicaciones WS |

**Problema clasico**: inyectar `prototype` en `singleton`
```java
// MAL - prototype se comporta como singleton
@Component
public class SingletonBean {
    @Autowired
    private PrototypeBean prototypeBean; // siempre la misma instancia!
}

// BIEN - usar ApplicationContext o @Lookup
@Component
public class SingletonBean {
    @Autowired
    private ApplicationContext context;

    public void doWork() {
        PrototypeBean bean = context.getBean(PrototypeBean.class); // nueva instancia
    }
}
```

#### Inyeccion de Dependencias
- **Constructor injection** (preferida): inmutabilidad, facilita testing, detecta ciclos al inicio
- **Field injection** (`@Autowired`): no recomendada, oculta dependencias, no testeable sin Spring
- **Setter injection**: dependencias opcionales

```java
// BIEN - constructor injection
@Service
public class OrderService {
    private final OrderRepository repository;
    private final PaymentService paymentService;

    public OrderService(OrderRepository repository, PaymentService paymentService) {
        this.repository = repository;
        this.paymentService = paymentService;
    }
}
```

#### Resolucion de Ambiguedad
- `@Primary`: bean preferido cuando hay multiples candidatos
- `@Qualifier("beanName")`: seleccionar bean especifico
- `@Profile("prod")`: activar bean segun perfil
- `@Conditional`: condicion personalizada

```java
@Configuration
public class DataSourceConfig {

    @Bean
    @Profile("prod")
    @Primary
    public DataSource prodDataSource() { /* ... */ }

    @Bean
    @Profile("dev")
    public DataSource devDataSource() { /* ... */ }
}
```

---

### 2. Spring Boot - Auto-Configuration

#### Como funciona
1. `@SpringBootApplication` incluye `@EnableAutoConfiguration`
2. Spring Boot escanea `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
3. Cada clase de auto-configuracion tiene condiciones `@Conditional`
4. Si las condiciones se cumplen, el bean se registra

```java
// Como Spring Boot auto-configura DataSource internamente
@AutoConfiguration
@ConditionalOnClass(DataSource.class)
@ConditionalOnMissingBean(DataSource.class) // solo si el usuario no definio uno propio
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {
    @Bean
    public DataSource dataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().build();
    }
}
```

#### Condiciones mas importantes
| Condicion | Descripcion |
|-----------|-------------|
| `@ConditionalOnClass` | Si la clase existe en classpath |
| `@ConditionalOnMissingClass` | Si la clase NO existe |
| `@ConditionalOnBean` | Si el bean existe en contexto |
| `@ConditionalOnMissingBean` | Si el bean NO existe |
| `@ConditionalOnProperty` | Si la propiedad tiene cierto valor |
| `@ConditionalOnWebApplication` | Si es aplicacion web |
| `@ConditionalOnExpression` | Basado en SpEL expression |

#### Crear tu propia Auto-Configuration
```java
@AutoConfiguration
@ConditionalOnClass(MyLibrary.class)
@ConditionalOnProperty(prefix = "my.library", name = "enabled", havingValue = "true")
public class MyLibraryAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public MyLibraryClient myLibraryClient(MyLibraryProperties props) {
        return new MyLibraryClient(props.getUrl());
    }
}
```
Registrar en `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`:
```
com.example.MyLibraryAutoConfiguration
```

#### Debugging de Auto-Configuration
```bash
# Ver que se auto-configuro y que no (y por que)
--debug flag o logging.level.org.springframework.boot.autoconfigure=DEBUG
```
- `/actuator/conditions` muestra el reporte en runtime

---

### 3. Spring MVC y REST

#### Flujo de una Request HTTP
1. `DispatcherServlet` recibe la request
2. `HandlerMapping` encuentra el controller correcto
3. `HandlerAdapter` ejecuta el metodo del controller
4. `ViewResolver` o `HttpMessageConverter` procesa la respuesta
5. Response enviada al cliente

#### Anotaciones clave
```java
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> findById(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean includeItems) {
        // ...
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderDto create(@Valid @RequestBody CreateOrderRequest request) {
        // ...
    }

    @PutMapping("/{id}")
    public OrderDto update(@PathVariable Long id, @Valid @RequestBody UpdateOrderRequest request) {
        // ...
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        // ...
    }
}
```

#### Manejo de Errores Global
```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(EntityNotFoundException ex) {
        return new ErrorResponse("NOT_FOUND", ex.getMessage());
    }

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
}
```

#### Validacion con Bean Validation
```java
public record CreateOrderRequest(
    @NotBlank String customerEmail,
    @NotNull @Positive BigDecimal amount,
    @NotEmpty @Size(min = 1, max = 50) List<@Valid OrderItem> items
) {}

// Validacion programatica cuando @Valid no alcanza
@Service
public class OrderService {
    private final Validator validator;

    public void create(Order order) {
        Set<ConstraintViolation<Order>> violations = validator.validate(order);
        if (!violations.isEmpty()) {
            throw new ConstraintViolationException(violations);
        }
    }
}
```

#### Filtros vs Interceptores
| | Filter | HandlerInterceptor |
|--|--------|-------------------|
| Nivel | Servlet (antes de Spring) | Spring MVC |
| Acceso a Spring beans | No directo | Si |
| Puede abortar request | Si | Si |
| Metodos | `doFilter()` | `preHandle()`, `postHandle()`, `afterCompletion()` |
| Uso tipico | Auth, logging, CORS | Logging, auth especifica de MVC |

```java
// Interceptor para medir tiempo de respuesta
@Component
public class TimingInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute("startTime", System.currentTimeMillis());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                 Object handler, Exception ex) {
        long duration = System.currentTimeMillis() - (long) request.getAttribute("startTime");
        log.info("Request {} took {}ms", request.getRequestURI(), duration);
    }
}
```

---

### 4. Spring Data JPA

#### Repositorios
```java
// Opciones de repositorio - saber diferencias
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Query derivada del nombre del metodo
    List<Order> findByStatusAndCreatedAtAfter(OrderStatus status, LocalDateTime date);

    // JPQL
    @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") Long id);

    // SQL nativo
    @Query(value = "SELECT * FROM orders WHERE total > :amount", nativeQuery = true)
    List<Order> findExpensiveOrders(@Param("amount") BigDecimal amount);

    // Modificacion
    @Modifying
    @Transactional
    @Query("UPDATE Order o SET o.status = :status WHERE o.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") OrderStatus status);
}
```

#### N+1 Problem - El tema mas preguntado en JPA
```java
// PROBLEMA - genera N+1 queries
List<Order> orders = orderRepository.findAll();
orders.forEach(o -> o.getItems().size()); // cada llamada genera 1 query extra

// SOLUCION 1 - JOIN FETCH en JPQL
@Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.items")
List<Order> findAllWithItems();

// SOLUCION 2 - @EntityGraph
@EntityGraph(attributePaths = {"items", "customer"})
List<Order> findAll();

// SOLUCION 3 - Batch size (Hibernate)
@OneToMany
@BatchSize(size = 20)
private List<OrderItem> items;
```

#### Transacciones
```java
// Propagacion - pregunta muy frecuente
@Transactional(propagation = Propagation.REQUIRED)    // default: usa la existente o crea nueva
@Transactional(propagation = Propagation.REQUIRES_NEW) // siempre crea nueva, suspende la existente
@Transactional(propagation = Propagation.NESTED)       // savepoint dentro de la existente
@Transactional(propagation = Propagation.SUPPORTS)     // usa la existente si hay, sino sin tx
@Transactional(propagation = Propagation.NEVER)        // falla si hay transaccion activa
@Transactional(propagation = Propagation.NOT_SUPPORTED)// suspende la existente

// Isolation levels
@Transactional(isolation = Isolation.READ_COMMITTED)   // evita dirty reads
@Transactional(isolation = Isolation.REPEATABLE_READ)  // evita non-repeatable reads
@Transactional(isolation = Isolation.SERIALIZABLE)     // evita phantom reads

// Rollback - solo RuntimeException por default
@Transactional(rollbackFor = Exception.class)
@Transactional(noRollbackFor = BusinessException.class)
```

**Trampa clasica**: `@Transactional` en metodos privados o llamadas internas no funciona
```java
@Service
public class OrderService {

    // MAL - llamada interna no pasa por el proxy AOP
    public void processOrders() {
        this.createOrder(); // @Transactional no aplica!
    }

    @Transactional
    public void createOrder() { /* ... */ }
}
```

#### Proyecciones
```java
// Interface projection - solo los campos necesarios
public interface OrderSummary {
    Long getId();
    String getStatus();
    BigDecimal getTotal();
}

List<OrderSummary> findByCustomerId(Long customerId);

// DTO projection con constructor expression
@Query("SELECT new com.example.dto.OrderDto(o.id, o.status, o.total) FROM Order o")
List<OrderDto> findOrderDtos();

// Dynamic projection
<T> List<T> findByCustomerId(Long customerId, Class<T> type);
```

---

### 5. Spring Security

#### Arquitectura de Security
1. Request llega a `SecurityFilterChain`
2. `UsernamePasswordAuthenticationFilter` o `BearerTokenAuthenticationFilter` extrae credenciales
3. `AuthenticationManager` delega a `AuthenticationProvider`
4. `UserDetailsService` carga el usuario
5. Token autenticado almacenado en `SecurityContextHolder`

#### Configuracion moderna (Spring Security 6+)
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable) // APIs REST stateless
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/products/**").hasAnyRole("USER", "ADMIN")
                .anyRequest().authenticated())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

#### JWT Implementation
```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws IOException, ServletException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        String username = jwtService.extractUsername(token);

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (jwtService.isTokenValid(token, userDetails)) {
                UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        filterChain.doFilter(request, response);
    }
}
```

#### Seguridad a nivel de metodo
```java
@Service
public class OrderService {

    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
    public List<Order> findByUser(Long userId) { /* ... */ }

    @PostAuthorize("returnObject.userId == authentication.principal.id")
    public Order findById(Long id) { /* ... */ }

    @PreAuthorize("hasPermission(#order, 'WRITE')")
    public void update(Order order) { /* ... */ }
}
```

---

### 6. Spring Boot Actuator y Observabilidad

#### Endpoints clave
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env,beans,conditions,loggers,threaddump,heapdump
  endpoint:
    health:
      show-details: always
  health:
    defaults:
      enabled: true
```

| Endpoint | Uso |
|----------|-----|
| `/actuator/health` | Estado de la app y dependencias |
| `/actuator/metrics` | Metricas de JVM, HTTP, custom |
| `/actuator/env` | Variables de entorno y propiedades |
| `/actuator/beans` | Todos los beans registrados |
| `/actuator/conditions` | Reporte de auto-configuration |
| `/actuator/loggers` | Ver y cambiar nivel de logs en runtime |
| `/actuator/threaddump` | Estado de todos los threads |
| `/actuator/heapdump` | Dump del heap para analizar |

#### Custom Health Indicator
```java
@Component
public class ExternalServiceHealthIndicator implements HealthIndicator {

    @Override
    public Health health() {
        try {
            boolean isUp = externalService.ping();
            return isUp ? Health.up().withDetail("url", serviceUrl).build()
                        : Health.down().withDetail("error", "Service unreachable").build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }
}
```

#### Metricas con Micrometer
```java
@Service
public class OrderService {
    private final Counter orderCounter;
    private final Timer orderTimer;

    public OrderService(MeterRegistry registry) {
        this.orderCounter = Counter.builder("orders.created")
            .tag("type", "standard")
            .description("Total orders created")
            .register(registry);

        this.orderTimer = Timer.builder("orders.processing.time")
            .description("Time to process an order")
            .register(registry);
    }

    public Order create(CreateOrderRequest request) {
        return orderTimer.record(() -> {
            Order order = processOrder(request);
            orderCounter.increment();
            return order;
        });
    }
}
```

---

### 7. Configuracion y Propiedades

#### @ConfigurationProperties (preferido sobre @Value)
```java
@ConfigurationProperties(prefix = "app.payment")
@Validated
public record PaymentProperties(
    @NotBlank String apiUrl,
    @NotNull @Positive Duration timeout,
    @Valid RetryConfig retry
) {
    public record RetryConfig(
        @Min(1) @Max(10) int maxAttempts,
        @NotNull Duration delay
    ) {}
}

// Registrar en @Configuration
@EnableConfigurationProperties(PaymentProperties.class)
```

```yaml
app:
  payment:
    api-url: https://api.payment.com
    timeout: 5s
    retry:
      max-attempts: 3
      delay: 1s
```

#### Perfiles y configuracion por ambiente
```yaml
# application.yml - configuracion base
spring:
  application:
    name: my-app

---
# application-dev.yml
spring:
  config:
    activate:
      on-profile: dev
  datasource:
    url: jdbc:h2:mem:testdb

---
# application-prod.yml
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: ${DB_URL}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
```

#### Orden de precedencia de propiedades (de mayor a menor)
1. Argumentos de linea de comando
2. Variables de entorno del SO
3. `application-{profile}.properties/yml`
4. `application.properties/yml`
5. `@PropertySource` en clases `@Configuration`
6. Valores default en `@Value`

---

## Prioridad MEDIA - Conocer bien

### 8. Spring AOP

#### Conceptos
- **Aspect**: clase con logica transversal
- **Advice**: que hacer (Before, After, Around, AfterReturning, AfterThrowing)
- **Pointcut**: donde aplicarlo (expresion que selecciona join points)
- **Join Point**: punto de ejecucion (tipicamente llamada a metodo)

```java
@Aspect
@Component
public class LoggingAspect {

    // Pointcut reutilizable
    @Pointcut("execution(* com.example.service.*.*(..))")
    public void serviceLayer() {}

    @Around("serviceLayer()")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            log.info("{} executed in {}ms",
                joinPoint.getSignature().getName(),
                System.currentTimeMillis() - start);
            return result;
        } catch (Exception e) {
            log.error("Exception in {}: {}", joinPoint.getSignature().getName(), e.getMessage());
            throw e;
        }
    }

    @AfterThrowing(pointcut = "serviceLayer()", throwing = "exception")
    public void handleException(JoinPoint joinPoint, Exception exception) {
        log.error("Exception in {}: {}", joinPoint.getSignature(), exception.getMessage());
    }
}
```

**Limitaciones de AOP con proxies**:
- No funciona en llamadas internas (self-invocation)
- No funciona en metodos privados
- No funciona en clases `final`
- JDK Proxy (solo interfaces) vs CGLIB (clases concretas)

---

### 9. Spring Cache

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()));

        return RedisCacheManager.builder(factory)
            .cacheDefaults(config)
            .build();
    }
}

@Service
public class ProductService {

    @Cacheable(value = "products", key = "#id", unless = "#result == null")
    public Product findById(Long id) { /* ... */ }

    @CachePut(value = "products", key = "#product.id")
    public Product update(Product product) { /* ... */ }

    @CacheEvict(value = "products", key = "#id")
    public void delete(Long id) { /* ... */ }

    @CacheEvict(value = "products", allEntries = true)
    public void clearAll() { /* ... */ }
}
```

---

### 10. Spring Events

```java
// Evento de dominio
public record OrderCreatedEvent(Order order, Instant occurredAt) {}

// Publisher
@Service
public class OrderService {
    private final ApplicationEventPublisher publisher;

    public Order create(CreateOrderRequest request) {
        Order order = save(request);
        publisher.publishEvent(new OrderCreatedEvent(order, Instant.now()));
        return order;
    }
}

// Listener - sincrono (misma transaccion)
@Component
public class NotificationListener {

    @EventListener
    @Async // ejecutar en thread separado
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT) // solo si commit exitoso
    public void onOrderCreated(OrderCreatedEvent event) {
        emailService.sendConfirmation(event.order());
    }
}
```

---

### 11. Testing en Spring Boot

#### Tipos de test y cuando usar cada uno

```java
// Unit test - sin Spring, rapido
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repository;
    @InjectMocks OrderService service;

    @Test
    void shouldCreateOrder() {
        when(repository.save(any())).thenReturn(mockOrder());
        Order result = service.create(request);
        assertThat(result).isNotNull();
        verify(repository).save(any());
    }
}

// Test de slice - solo capa web, sin BD
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean OrderService service;

    @Test
    void shouldReturnOrder() throws Exception {
        when(service.findById(1L)).thenReturn(mockOrder());
        mockMvc.perform(get("/api/orders/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1));
    }
}

// Test de slice - solo capa datos, con BD en memoria
@DataJpaTest
class OrderRepositoryTest {
    @Autowired TestEntityManager em;
    @Autowired OrderRepository repository;

    @Test
    void shouldFindByStatus() {
        em.persist(new Order(OrderStatus.PENDING));
        List<Order> result = repository.findByStatus(OrderStatus.PENDING);
        assertThat(result).hasSize(1);
    }
}

// Integration test - contexto completo
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = Replace.NONE)
@Testcontainers
class OrderIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
    }

    @Autowired TestRestTemplate restTemplate;

    @Test
    void shouldCreateOrderEndToEnd() {
        ResponseEntity<OrderDto> response = restTemplate.postForEntity(
            "/api/orders", request, OrderDto.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }
}
```

#### Anotaciones de Testing utiles
- `@Sql`: ejecutar scripts SQL antes/despues de tests
- `@DirtiesContext`: reiniciar contexto entre tests
- `@TestPropertySource`: propiedades especificas para test
- `@MockBean`: reemplaza bean en contexto de Spring
- `@SpyBean`: espiar bean real en contexto de Spring

---

### 12. Spring Boot con Kafka

```java
@Configuration
public class KafkaConfig {

    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true); // exactly-once
        return new DefaultKafkaProducerFactory<>(props);
    }
}

// Producer
@Service
public class OrderEventProducer {
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publish(OrderCreatedEvent event) {
        kafkaTemplate.send("orders.created", event.orderId().toString(), event)
            .whenComplete((result, ex) -> {
                if (ex != null) log.error("Failed to publish event", ex);
                else log.info("Event published to partition {}", result.getRecordMetadata().partition());
            });
    }
}

// Consumer
@Service
public class OrderEventConsumer {

    @KafkaListener(
        topics = "orders.created",
        groupId = "notification-service",
        containerFactory = "kafkaListenerContainerFactory"
    )
    public void consume(
            @Payload OrderCreatedEvent event,
            @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
            Acknowledgment ack) {
        try {
            notificationService.notify(event);
            ack.acknowledge(); // manual commit
        } catch (Exception e) {
            log.error("Failed to process event, sending to DLT");
            throw e; // Spring Kafka enviara a Dead Letter Topic
        }
    }
}
```

---

## Prioridad ALTA - Preguntas trampa comunes

### Preguntas Clasicas con Respuesta

**¿Cuándo NO funciona @Transactional?**
- Llamadas al mismo metodo dentro de la misma clase (self-invocation)
- Metodos privados o protected
- Clases que no son Spring Beans
- Excepciones checked (no hace rollback por default)

**¿Cuál es la diferencia entre @Component, @Service, @Repository, @Controller?**
- Funcionalmente identicos - todos son `@Component`
- Diferencias semanticas y tecnicas:
  - `@Repository`: activa traduccion de excepciones de persistencia a `DataAccessException`
  - `@Controller`: detectado por `DispatcherServlet`
  - `@Service`: no tiene comportamiento extra, solo semantica

**¿Qué pasa si tienes dos beans del mismo tipo sin @Primary ni @Qualifier?**
- `NoUniqueBeanDefinitionException` al arrancar el contexto

**¿Cuándo usar @RestController vs @Controller?**
- `@RestController` = `@Controller` + `@ResponseBody` en cada metodo
- `@Controller` se usa con vistas (Thymeleaf, JSP)

**¿Qué es un Proxy en Spring y por qué importa?**
- Spring envuelve los beans en proxies para aplicar AOP
- JDK Proxy: solo funciona si el bean implementa interfaces
- CGLIB: funciona con clases concretas (crea subclase en runtime)
- Por eso `@Transactional` no funciona en llamadas internas

**¿Diferencia entre @MockBean y @Mock?**
- `@Mock` (Mockito): crea mock sin Spring, rapido
- `@MockBean` (Spring): reemplaza el bean en el contexto de Spring, mas lento

---

## Cronograma para Hoy

| Bloque | Tema | Tiempo |
|--------|------|--------|
| 1 | Spring Core: IoC, DI, scopes, ciclo de vida | 1.5h |
| 2 | Auto-Configuration: como funciona, condiciones | 1h |
| 3 | Spring MVC: DispatcherServlet, validacion, error handling | 1h |
| 4 | Spring Data JPA: N+1, transacciones, proyecciones | 1.5h |
| 5 | Spring Security: JWT, filtros, method security | 1h |
| 6 | Actuator + Micrometer + Observabilidad | 45min |
| 7 | AOP + Cache + Events | 45min |
| 8 | Testing: slices, TestContainers, MockBean vs Mock | 1h |
| 9 | Kafka con Spring Boot | 30min |
| 10 | Preguntas trampa + repaso puntos debiles | 30min |

---

## Tips para Diferenciarte como Senior

1. **Explica el "por que"**, no solo el "como"
   - No solo "uso constructor injection" sino "porque garantiza inmutabilidad y hace dependencias visibles"

2. **Menciona trade-offs** siempre
   - "Lazy loading evita N+1 pero puede causar LazyInitializationException fuera de transaccion"

3. **Habla de produccion**
   - Circuit breakers, rate limiting, graceful shutdown, timeouts

4. **Graceful Shutdown**
   ```yaml
   server:
     shutdown: graceful
   spring:
     lifecycle:
       timeout-per-shutdown-phase: 30s
   ```

5. **Conoce la configuracion de conexiones**
   ```yaml
   spring:
     datasource:
       hikari:
         maximum-pool-size: 10
         minimum-idle: 5
         connection-timeout: 30000
         idle-timeout: 600000
         max-lifetime: 1800000
   ```

6. **Menciona seguridad proactiva**
   - Sanitizacion de inputs, no loguear datos sensibles, secrets en variables de entorno

7. **Performance**
   - Paginacion en endpoints que retornan colecciones
   - Async donde tenga sentido
   - Caching estrategico con invalidacion correcta
