---
title: "Guía Completa - Entrevista Java Senior"
description: "Conceptos clave de Java para entrevistas senior: JVM, concurrencia, patrones, colecciones y más."
tags: ["java", "spring-boot", "senior", "entrevistas"]
date: "2024-01-01"
---

# Guia Completa - Entrevista Java Senior (Spring Boot)

> Cada tema incluye: que es, por que existe, ejemplo, comparaciones, cuando usar, cuando NO usar, debilidades y curiosidades de examen avanzado.

---

# 1. Spring Core - IoC y Dependency Injection

## Que es IoC (Inversion of Control)

IoC es un principio de diseno en el que el control del flujo de un programa se invierte: en lugar de que el objeto cree sus dependencias, un contenedor externo las crea e inyecta.

Sin IoC: `MiClase crea -> Dependencia`
Con IoC: `Contenedor crea -> MiClase + Dependencia -> inyecta en MiClase`

## Por que existe

El problema que resuelve: el acoplamiento fuerte. Si `OrderService` instancia directamente `OrderRepository` con `new`, no puedes:
- Cambiar la implementacion sin modificar `OrderService`
- Testear `OrderService` sin la base de datos real
- Reutilizar `OrderService` en otro contexto

IoC desacopla la creacion de objetos de su uso. El resultado es codigo mas mantenible, testeable y flexible.

## Que es DI (Dependency Injection)

DI es la implementacion mas comun de IoC. En lugar de que el objeto busque sus dependencias (`Service Locator pattern`), el contenedor las entrega activamente al objeto.

```java
// SIN DI - alto acoplamiento
public class OrderService {
    private OrderRepository repo = new OrderRepositoryImpl(); // dependencia hardcodeada
}

// CON DI - bajo acoplamiento
public class OrderService {
    private final OrderRepository repo; // el contenedor la provee

    public OrderService(OrderRepository repo) { // constructor injection
        this.repo = repo;
    }
}
```

## Tipos de Inyeccion

### Constructor Injection (RECOMENDADA)
```java
@Service
public class OrderService {
    private final OrderRepository repository;
    private final PaymentService paymentService;

    // Con Lombok @RequiredArgsConstructor se omite el constructor
    public OrderService(OrderRepository repository, PaymentService paymentService) {
        this.repository = repository;
        this.paymentService = paymentService;
    }
}
```
**Ventajas:**
- Campos `final` -> inmutabilidad garantizada
- Dependencias visibles en el contrato publico de la clase
- Si falta una dependencia, falla en compilacion (no en runtime)
- Spring detecta ciclos de dependencias circulares al arrancar (fail-fast)
- Facil de testear sin Spring: `new OrderService(mockRepo, mockPayment)`

### Field Injection (NO RECOMENDADA)
```java
@Service
public class OrderService {
    @Autowired
    private OrderRepository repository; // Spring usa reflection para inyectar
}
```
**Por que NO usarla:**
- El campo no puede ser `final`
- No puedes testear sin arrancar el contexto de Spring
- Las dependencias estan ocultas (no en el constructor)
- Puede llevar a NPE si intentas usar la clase fuera de Spring
- SonarQube y PMD la marcan como violacion

### Setter Injection
```java
@Service
public class OrderService {
    private EmailService emailService;

    @Autowired(required = false) // dependencia OPCIONAL
    public void setEmailService(EmailService emailService) {
        this.emailService = emailService;
    }
}
```
**Cuando usarla:** solo para dependencias opcionales o cuando necesitas permitir re-inyeccion en runtime (muy raro).

## BeanFactory vs ApplicationContext

| Caracteristica | BeanFactory | ApplicationContext |
|---|---|---|
| Carga de beans | Lazy (bajo demanda) | Eager (al arrancar) |
| AOP | No soporte nativo | Si |
| Eventos | No | Si (ApplicationEvent) |
| I18n | No | Si (MessageSource) |
| Auto-deteccion de BeanPostProcessor | No (manual) | Si |
| Memoria | Menor | Mayor |
| Uso tipico | Entornos con memoria muy limitada | SIEMPRE en produccion |

**Curiosidad de examen**: `BeanFactory` es la interfaz base. `ApplicationContext` la extiende. Desde Spring 2.0, no hay razon practica para usar `BeanFactory` directamente. Casi nunca lo veras en codigo moderno.

## Ciclo de Vida Completo de un Bean

```
1. Instanciacion (constructor)
2. Inyeccion de dependencias (setters o fields)
3. setBeanName (BeanNameAware)
4. setBeanFactory (BeanFactoryAware)
5. setApplicationContext (ApplicationContextAware)
6. BeanPostProcessor.postProcessBeforeInitialization()
7. @PostConstruct
8. InitializingBean.afterPropertiesSet()
9. @Bean(initMethod = "init")
10. BeanPostProcessor.postProcessAfterInitialization()
--- Bean listo para usar ---
11. @PreDestroy
12. DisposableBean.destroy()
13. @Bean(destroyMethod = "cleanup")
```

**Curiosidad critica**: `@PostConstruct` se ejecuta ANTES que `afterPropertiesSet()`. Si implementas ambos, el orden importa.

```java
@Component
public class MyBean implements InitializingBean, DisposableBean {

    @PostConstruct
    public void postConstruct() {
        // Ejecuta primero - usar para inicializacion ligera
        // Nota: aqui las dependencias YA estan inyectadas
    }

    @Override
    public void afterPropertiesSet() {
        // Ejecuta segundo - inicializacion mas pesada
        // Acoplado a Spring (implementa interfaz de Spring)
    }

    @PreDestroy
    public void preDestroy() {
        // Al destruir el contexto - cerrar recursos
    }

    @Override
    public void destroy() {
        // Acoplado a Spring
    }
}
```

**Recomendacion**: usar `@PostConstruct` / `@PreDestroy` (estandar JSR-250) sobre las interfaces de Spring para evitar acoplamiento.

## Scopes

### Singleton (default)
- **Que es**: una sola instancia por `ApplicationContext`
- **Curiosidad**: NO es el patron Singleton del GoF. Si tienes 2 `ApplicationContext`, tienes 2 instancias.
- **Cuando usar**: servicios, repositorios, cualquier bean sin estado
- **Cuando NO usar**: beans con estado mutable compartido entre threads -> race conditions

### Prototype
- **Que es**: nueva instancia cada vez que se solicita al contenedor
- **Curiosidad critica**: Spring crea el bean pero NO gestiona su destruccion. `@PreDestroy` NUNCA se llama en beans prototype.
- **Cuando usar**: beans con estado que no deben compartirse
- **Problema clasico**: inyectar prototype en singleton

```java
// El problema: singleton mantiene referencia a UNA instancia de prototype
// La instancia nunca cambia aunque prototype deberia crear nuevas

// Solucion 1: ApplicationContext
@Component
public class SingletonBean {
    @Autowired
    private ApplicationContext context;

    public void doWork() {
        PrototypeBean proto = context.getBean(PrototypeBean.class); // siempre nueva
    }
}

// Solucion 2: @Lookup (mas elegante, Spring genera subclase en runtime)
@Component
public abstract class SingletonBean {

    public void doWork() {
        PrototypeBean proto = createPrototype(); // delegado a Spring
    }

    @Lookup
    protected abstract PrototypeBean createPrototype();
}

// Solucion 3: Provider<T> (estandar JSR-330)
@Component
public class SingletonBean {
    @Autowired
    private Provider<PrototypeBean> prototypeProvider;

    public void doWork() {
        PrototypeBean proto = prototypeProvider.get();
    }
}
```

## Resolucion de Ambiguedad

**Escenario**: tienes dos implementaciones de la misma interfaz.

```java
@Primary // candidato preferido cuando hay ambiguedad
@Service
public class PostgresOrderRepository implements OrderRepository { }

@Service
public class MongoOrderRepository implements OrderRepository { }

// En el consumer:
@Service
public class OrderService {
    private final OrderRepository repository; // inyecta PostgresOrderRepository (por @Primary)

    // Para forzar el otro:
    @Qualifier("mongoOrderRepository")
    private final OrderRepository altRepository;
}
```

**Curiosidad**: el nombre del bean por default es el nombre de la clase en camelCase. `MongoOrderRepository` -> `"mongoOrderRepository"`.

## Debilidades de IoC/DI en Spring

1. **Magic negra**: el comportamiento implicito puede sorprender a nuevos desarrolladores
2. **Rendimiento al arrancar**: el escaneo de classpath y creacion de beans agrega tiempo de startup
3. **Ciclos de dependencia**: `A -> B -> A` puede causar problemas (constructor injection lo detecta al arrancar, field injection puede fallar en runtime)
4. **Dificil de seguir el flujo**: IDE debuggers no muestran el grafo de dependencias facilmente
5. **Reflection overhead**: field injection usa reflection que es mas lento que llamadas directas

## Curiosidades para Examen Avanzado

1. **Spring 6 no necesita `@Autowired` en constructor**: si hay un solo constructor, Spring lo usa automaticamente sin anotacion.

2. **`@Autowired` puede inyectar colecciones**: `List<Handler>` inyecta TODOS los beans de tipo `Handler` en orden (usa `@Order` para controlar el orden).

3. **`required = false`**: `@Autowired(required = false)` no lanza excepcion si no encuentra el bean. Alternativa moderna: `Optional<MyBean>`.

4. **Beans de infraestructura**: `BeanPostProcessor` y `BeanFactoryPostProcessor` se instancian MUY temprano, antes que otros beans. Si un `@Configuration` depende de un bean normal, puede fallar.

5. **Lazy initialization**: `@Lazy` en el bean o globalmente con `spring.main.lazy-initialization=true` hace que los beans se creen solo cuando se necesitan. Reduce el tiempo de startup pero mueve errores de inicializacion al primer uso.

---

# 2. Spring Boot - Auto-Configuration

## Que es

Auto-configuration es el mecanismo por el que Spring Boot configura automaticamente tu aplicacion basandose en las dependencias que tienes en el classpath y en las propiedades que defines. Es el corazon de la filosofia "convention over configuration".

## Por que existe

Antes de Spring Boot (Spring vanilla), necesitabas XML o clases `@Configuration` para cada cosa: configurar el `DataSource`, el `EntityManagerFactory`, el `TransactionManager`, el `DispatcherServlet`, etc. Cientos de lineas de configuracion repetitiva en cada proyecto.

Spring Boot elimina ese boilerplate detectando automaticamente que tienes `spring-data-jpa` en el classpath y configurando todo lo necesario.

## Como Funciona Internamente

```
1. @SpringBootApplication contiene @EnableAutoConfiguration
2. @EnableAutoConfiguration importa AutoConfigurationImportSelector
3. Este selector lee META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
4. Carga ~150 clases de auto-configuracion candidatas
5. Evalua las condiciones @Conditional de cada una
6. Solo registra los beans de las clases cuyas condiciones se cumplen
```

```java
// Lo que Spring Boot hace internamente para DataSource:
@AutoConfiguration
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")
@EnableConfigurationProperties(DataSourceProperties.class)
@Import({ DataSourcePoolMetadataProvidersConfiguration.class,
          DataSourceCheckpointRestoreConfiguration.class })
public class DataSourceAutoConfiguration {

    @Configuration(proxyBeanMethods = false)
    @Conditional(EmbeddedDatabaseCondition.class)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @Import(EmbeddedDataSourceConfiguration.class)
    protected static class EmbeddedDatabaseConfiguration { }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @ConditionalOnSingleCandidate(DataSourceProperties.class)
    @Import({ Hikari.class, Tomcat.class, Dbcp2.class, ... })
    protected static class PooledDataSourceConfiguration { }
}
```

## Condiciones @Conditional

```java
@ConditionalOnClass(Foo.class)          // La clase Foo existe en el classpath
@ConditionalOnMissingClass("com.Foo")  // La clase NO existe
@ConditionalOnBean(Foo.class)           // Hay un bean de tipo Foo en el contexto
@ConditionalOnMissingBean(Foo.class)   // NO hay bean de tipo Foo (mas importante!)
@ConditionalOnProperty(
    prefix = "my.feature",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = false              // comportamiento si la propiedad no existe
)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnExpression("${feature.x} && ${feature.y}")
@ConditionalOnJava(JavaVersion.SEVENTEEN) // version minima de Java
@ConditionalOnResource("classpath:config.xml") // archivo existe
@ConditionalOnCloudPlatform(CloudPlatform.KUBERNETES)
```

**La mas importante para entrevistas**: `@ConditionalOnMissingBean` es el patron que permite al usuario OVERRIDEAR la auto-configuracion simplemente definiendo su propio bean. Si defines un `DataSource` en tu `@Configuration`, Spring Boot no crea el suyo.

## Crear tu Propia Auto-Configuration (Libreria)

```java
// 1. Crea la clase de propiedades
@ConfigurationProperties(prefix = "my.client")
public record MyClientProperties(
    @NotBlank String baseUrl,
    Duration timeout
) {}

// 2. Crea la auto-configuration
@AutoConfiguration
@ConditionalOnClass(MyClient.class)
@ConditionalOnProperty(prefix = "my.client", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(MyClientProperties.class)
public class MyClientAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean // si el usuario ya definio un MyClient, no sobreescribir
    public MyClient myClient(MyClientProperties props) {
        return MyClient.builder()
            .baseUrl(props.baseUrl())
            .timeout(props.timeout())
            .build();
    }
}

// 3. Registrar en src/main/resources/META-INF/spring/
//    org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.example.MyClientAutoConfiguration
```

## Debugging de Auto-Configuration

```bash
# Opcion 1: flag al arrancar
java -jar app.jar --debug

# Opcion 2: propiedad
logging.level.org.springframework.boot.autoconfigure=DEBUG

# Opcion 3: Actuator en runtime
GET /actuator/conditions
```

El reporte muestra tres secciones:
- **Positive matches**: auto-configs que SE aplicaron y por que
- **Negative matches**: auto-configs que NO se aplicaron y por que
- **Unconditional classes**: siempre se aplican

## Comparacion: Auto-Configuration vs @Configuration manual

| | Auto-Configuration | @Configuration manual |
|---|---|---|
| Cuando usar | Librerias/starters compartidos | Configuracion especifica de tu app |
| Mecanismo | @Conditional + imports file | Siempre activo |
| Override | Por defecto permite override | Tienes que manejar conflictos |
| Discovery | Automatico | Manual (component scan) |

## Cuando NO usar Auto-Configuration

- Cuando necesitas control total y preciso sobre la configuracion
- Cuando hay conflictos entre multiple auto-configs
- Cuando quieres deshabilitar: `@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})`

## Debilidades

1. **Magia implicita**: es dificil saber QUE se esta configurando sin leer el codigo fuente de Spring Boot
2. **Debug complicado**: cuando algo falla en la configuracion, el stack trace puede ser confuso
3. **Conflictos**: si dos librerias configuran el mismo bean, puede haber comportamiento inesperado
4. **Startup lento**: evaluar ~150 condiciones agrega tiempo (minimo, pero existe)
5. **Version lock**: actualizar Spring Boot puede cambiar el comportamiento de auto-configs

## Curiosidades para Examen Avanzado

1. **El archivo de imports cambio en Spring Boot 3**: antes era `spring.factories`, ahora es `AutoConfiguration.imports`. El viejo formato sigue funcionando para compatibilidad pero esta deprecado.

2. **`@AutoConfiguration` vs `@Configuration`**: `@AutoConfiguration` es una especializacion que ademas define orden relativo entre auto-configuraciones con `@AutoConfigureBefore` / `@AutoConfigureAfter`.

3. **`proxyBeanMethods = false`**: las auto-configurations internas de Spring Boot usan esto para mejor rendimiento. Significa que los metodos `@Bean` dentro no pasan por el proxy de CGLIB, haciendo las llamadas mas rapidas pero perdiendo la garantia de singleton entre llamadas entre metodos `@Bean` de la misma clase.

4. **Orden de evaluacion**: las auto-configs se procesan despues de todos los beans definidos por el usuario. Por eso `@ConditionalOnMissingBean` funciona correctamente: primero se registran tus beans, luego se evalua si los auto-configurados son necesarios.

---

# 3. Spring MVC y REST

## Que es DispatcherServlet

Es el front controller de Spring MVC. Recibe TODAS las peticiones HTTP y las delega a los componentes correctos. Es un `Servlet` de Java EE/Jakarta EE que Spring registra automaticamente.

## Por que existe

Sin un front controller, tendrias un servlet por endpoint, cada uno manejando parsing de request, serializacion, errores, etc. `DispatcherServlet` centraliza todo esto.

## Flujo Completo de una Request HTTP

```
Cliente HTTP
    |
    v
DispatcherServlet (punto de entrada unico)
    |
    v
HandlerMapping (¿que controller maneja esta URL?)
    - RequestMappingHandlerMapping (para @RequestMapping)
    - BeanNameUrlHandlerMapping
    |
    v
HandlerAdapter (¿como ejecutar el handler?)
    - RequestMappingHandlerAdapter (para @Controller)
    |
    v
HandlerInterceptor.preHandle() (antes de ejecutar)
    |
    v
Controller method ejecutado
    - Argument resolvers (convierte parametros: @PathVariable, @RequestBody, etc.)
    - Return value handlers (convierte el retorno a response)
    |
    v
HandlerInterceptor.postHandle() (despues de ejecutar, antes de render)
    |
    v
HttpMessageConverter (serializa el objeto a JSON/XML)
    |
    v
HandlerInterceptor.afterCompletion() (siempre, incluso si hay excepcion)
    |
    v
Response al cliente
```

## @RestController vs @Controller

```java
// @Controller: para vistas (Thymeleaf, JSP)
@Controller
public class WebController {

    @GetMapping("/home")
    public String home(Model model) {
        model.addAttribute("user", currentUser());
        return "home"; // nombre de la vista (template)
    }

    @GetMapping("/data")
    @ResponseBody // necesario para retornar JSON desde un @Controller
    public UserDto getUser() {
        return new UserDto();
    }
}

// @RestController = @Controller + @ResponseBody en TODOS los metodos
@RestController
public class ApiController {

    @GetMapping("/users")
    public List<UserDto> getUsers() { // serializado automaticamente a JSON
        return userService.findAll();
    }
}
```

## ResponseEntity vs @ResponseStatus

```java
// ResponseEntity: control total sobre codigo, headers y body
@GetMapping("/{id}")
public ResponseEntity<UserDto> findById(@PathVariable Long id) {
    return userService.findById(id)
        .map(ResponseEntity::ok)                          // 200
        .orElse(ResponseEntity.notFound().build());       // 404

    // O mas explicito:
    return ResponseEntity
        .status(HttpStatus.OK)
        .header("X-Custom", "value")
        .body(dto);
}

// @ResponseStatus: cuando el codigo es siempre el mismo
@PostMapping
@ResponseStatus(HttpStatus.CREATED) // siempre 201
public UserDto create(@RequestBody CreateUserRequest req) {
    return userService.create(req);
}
```

## Parametros de Request

```java
@GetMapping("/search")
public Page<UserDto> search(
    @PathVariable Long orgId,                          // /orgs/{orgId}/users
    @RequestParam String name,                         // ?name=john
    @RequestParam(defaultValue = "0") int page,       // ?page=2
    @RequestParam(required = false) String email,      // opcional
    @RequestHeader("Authorization") String auth,       // header
    @RequestBody @Valid SearchRequest body,            // body JSON
    @CookieValue("session") String sessionId,         // cookie
    Pageable pageable                                  // Spring Data pagination
) { }
```

## Manejo de Errores Global con @RestControllerAdvice

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // Excepcion de negocio personalizada
    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(OrderNotFoundException ex) {
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    // Validacion de @Valid
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(e ->
            errors.put(e.getField(), e.getDefaultMessage())
        );
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("VALIDATION_ERROR", errors));
    }

    // Cualquier excepcion no manejada
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
```

## Filtros vs HandlerInterceptors

### Filter (nivel Servlet - antes de Spring MVC)
```java
@Component
@Order(1) // orden de ejecucion
public class RequestLoggingFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        log.info("Request: {} {}", req.getMethod(), req.getRequestURI());
        chain.doFilter(request, response); // continuar la cadena
        // despues de la respuesta:
        log.info("Response: {}", ((HttpServletResponse) response).getStatus());
    }
}
```

### HandlerInterceptor (nivel Spring MVC)
```java
@Component
public class AuthorizationInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {
        // Si retorna false, se detiene el procesamiento
        if (!isAuthorized(request)) {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            return false;
        }
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response,
                           Object handler, ModelAndView modelAndView) throws Exception {
        // Solo se llama si preHandle retorno true Y el controller no lanzo excepcion
        // Con @RestController el modelAndView es null
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) throws Exception {
        // SIEMPRE se llama (si preHandle retorno true), incluso con excepcion
        // Ideal para limpieza de recursos (MDC, timers, etc.)
    }
}

// Registrar el interceptor:
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authorizationInterceptor)
            .addPathPatterns("/api/**")
            .excludePathPatterns("/api/public/**");
    }
}
```

| | Filter | HandlerInterceptor |
|---|---|---|
| Nivel | Servlet (Jakarta EE) | Spring MVC |
| Acceso a beans Spring | Via @Autowired si es @Component | Si, es un bean Spring |
| Puede ver el Handler | No | Si (tipo Controller) |
| `postHandle` en excepcion | Si (siempre) | No (solo sin excepcion) |
| Modificar response | Si | Solo antes del render |
| Casos de uso | CORS, compresion, logging basico, seguridad pre-Spring | Logging de business, auth especifica de MVC, metricas por endpoint |

## Cuando usar Filter vs Interceptor

- **Filter**: cuando necesitas actuar ANTES de que Spring MVC entre en juego (ej: decodificar el body antes del routing)
- **Filter**: para CORS, ya que Spring Security tambien usa filtros
- **Interceptor**: cuando necesitas acceso al handler (controller method) o al modelo
- **Interceptor**: para logica especifica de MVC como metricas por controlador

## Debilidades de Spring MVC

1. **Sincrono por default**: cada request bloquea un thread (solucion: Spring WebFlux para reactivo)
2. **DispatcherServlet como SPOF**: si falla, toda la app falla
3. **Serializacion implicita**: Jackson puede incluir datos sensibles si no configuras correctamente
4. **Manejo de errores inconsistente**: `@ExceptionHandler` vs `ErrorController` pueden solaparse
5. **CORS**: configuracion compleja cuando tienes multiples origenss y Spring Security

## Curiosidades para Examen Avanzado

1. **`@RequestBody` usa `HttpMessageConverter`**: Spring tiene multiples convertidores (Jackson para JSON, JAXB para XML, etc.). Se selecciona basandose en el `Content-Type` de la request y el `Accept` header.

2. **`HandlerMethodArgumentResolver`**: puedes crear argumentos personalizados para tus controller methods (ej: `@CurrentUser UserPrincipal user`).

3. **`@ModelAttribute`**: puede ser a nivel de metodo (ejecuta antes que los handlers y agrega al modelo) o a nivel de parametro (binding de form data).

4. **Content Negotiation**: Spring puede retornar JSON o XML del mismo endpoint dependiendo del `Accept` header del cliente.

5. **`@JsonView`**: puedes tener diferentes vistas JSON del mismo objeto segun el endpoint. Ej: vista publica sin campos sensibles vs vista admin con todo.

---

# 4. Spring Data JPA

## Que es

Spring Data JPA es una capa de abstraccion sobre JPA (Java Persistence API) que elimina el boilerplate de implementar repositorios. JPA es la especificacion; Hibernate es la implementacion mas comun.

## Por que existe

Sin Spring Data JPA necesitarias:
```java
// EntityManager manual - mucho boilerplate
public class OrderRepositoryImpl {
    @PersistenceContext
    private EntityManager em;

    public Order findById(Long id) {
        return em.find(Order.class, id);
    }

    public List<Order> findByStatus(OrderStatus status) {
        return em.createQuery("SELECT o FROM Order o WHERE o.status = :status", Order.class)
            .setParameter("status", status)
            .getResultList();
    }

    public Order save(Order order) {
        if (order.getId() == null) {
            em.persist(order);
            return order;
        }
        return em.merge(order);
    }
    // + findAll, delete, count, etc.
}
```

Spring Data JPA genera toda esa implementacion automaticamente.

## Jerarquia de Repositorios

```
Repository (marker interface)
    |
    CrudRepository (save, findById, findAll, delete, count, existsById)
        |
        PagingAndSortingRepository (findAll(Pageable), findAll(Sort))
            |
            JpaRepository (flush, saveAndFlush, deleteInBatch, getById, findAll con especificaciones)
```

**Curiosidad**: `getById(id)` retorna un proxy lazy (no hace query inmediatamente). `findById(id)` retorna `Optional<T>` y hace la query de inmediato. Usar `getById` cuando solo necesitas la referencia para asociaciones.

## Metodos Derivados

Spring Data genera queries a partir del nombre del metodo:

```java
public interface UserRepository extends JpaRepository<User, Long> {

    // SELECT * FROM users WHERE email = ?
    Optional<User> findByEmail(String email);

    // SELECT * FROM users WHERE first_name = ? AND last_name = ?
    List<User> findByFirstNameAndLastName(String firstName, String lastName);

    // SELECT * FROM users WHERE age > ? ORDER BY name ASC
    List<User> findByAgeGreaterThanOrderByNameAsc(int age);

    // SELECT * FROM users WHERE name LIKE ?
    List<User> findByNameContainingIgnoreCase(String name);

    // SELECT COUNT(*) FROM users WHERE active = ?
    long countByActive(boolean active);

    // DELETE FROM users WHERE active = false
    void deleteByActiveFalse();

    // EXISTS
    boolean existsByEmail(String email);

    // Limitar resultados
    List<User> findTop5ByOrderByCreatedAtDesc(); // los 5 mas recientes
    Optional<User> findFirstByOrderByPriorityDesc();
}
```

**Palabras clave disponibles**: `And`, `Or`, `Is`, `Equals`, `Between`, `LessThan`, `GreaterThan`, `Like`, `NotLike`, `StartingWith`, `EndingWith`, `Containing`, `OrderBy`, `Not`, `In`, `NotIn`, `True`, `False`, `IgnoreCase`, `AllIgnoreCase`, `Top`, `First`, `Distinct`.

## JPQL vs SQL Nativo vs Criterial API

```java
// JPQL - orientado a entidades, portatil entre DBs
@Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.customer.id = :customerId")
List<Order> findByCustomerIdWithItems(@Param("customerId") Long customerId);

// SQL Nativo - cuando necesitas features especificos de la DB
@Query(value = "SELECT * FROM orders WHERE EXTRACT(MONTH FROM created_at) = :month",
       nativeQuery = true)
List<Order> findByMonth(@Param("month") int month);

// Criterial API - queries dinamicas type-safe (pero verbose)
public List<Order> findWithCriteria(OrderFilter filter) {
    CriteriaBuilder cb = em.getCriteriaBuilder();
    CriteriaQuery<Order> query = cb.createQuery(Order.class);
    Root<Order> root = query.from(Order.class);

    List<Predicate> predicates = new ArrayList<>();
    if (filter.getStatus() != null)
        predicates.add(cb.equal(root.get("status"), filter.getStatus()));
    if (filter.getMinAmount() != null)
        predicates.add(cb.greaterThanOrEqualTo(root.get("total"), filter.getMinAmount()));

    query.where(predicates.toArray(new Predicate[0]));
    return em.createQuery(query).getResultList();
}

// Specifications (Criteria API simplificada)
public interface OrderRepository extends JpaRepository<Order, Long>,
                                          JpaSpecificationExecutor<Order> {}

// Usar:
Specification<Order> spec = Specification
    .where(OrderSpecs.hasStatus(PENDING))
    .and(OrderSpecs.totalGreaterThan(BigDecimal.valueOf(100)));

orderRepository.findAll(spec, PageRequest.of(0, 20));
```

## N+1 Problem - El Mas Preguntado

### El Problema
```java
// Tienes Order con List<OrderItem> (LAZY por default en @OneToMany)
List<Order> orders = orderRepository.findAll(); // 1 query: SELECT * FROM orders
for (Order order : orders) {
    // Cada acceso a getItems() genera 1 query adicional!
    System.out.println(order.getItems().size()); // N queries: SELECT * FROM order_items WHERE order_id = ?
}
// Total: 1 + N queries
```

### Soluciones

```java
// Solucion 1: JOIN FETCH (la mas comun)
@Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.items")
List<Order> findAllWithItems();
// El DISTINCT evita duplicados cuando hay multiples items por order

// Solucion 2: @EntityGraph (mas declarativa)
@EntityGraph(attributePaths = {"items", "customer"})
List<Order> findAll();

// Solucion 3: @BatchSize (N+1 se convierte en ceil(N/batchSize) queries)
@Entity
public class Order {
    @OneToMany
    @BatchSize(size = 20) // Hibernate carga items de 20 en 20
    private List<OrderItem> items;
}

// Solucion 4: hibernate.default_batch_fetch_size global en properties
spring.jpa.properties.hibernate.default_batch_fetch_size=20

// Solucion 5: DTO projection (cuando solo necesitas algunos campos)
@Query("SELECT new com.example.dto.OrderSummary(o.id, o.status, COUNT(i)) FROM Order o LEFT JOIN o.items i GROUP BY o.id, o.status")
List<OrderSummary> findOrderSummaries();
```

**Trampa en entrevista**: JOIN FETCH con paginacion (`Pageable`) puede dar resultados incorrectos porque Hibernate aplica el LIMIT en memoria, no en la query SQL. Ver `HHH90003004` warning. Solucion: usar `@BatchSize` o dos queries separadas.

## Transacciones - Propagacion

```java
// REQUIRED (default): usa la transaccion existente, o crea una nueva
@Transactional(propagation = Propagation.REQUIRED)
public void methodA() {
    methodB(); // participa en la misma transaccion de A
}

// REQUIRES_NEW: siempre crea una nueva, suspende la existente
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void audit(String action) {
    // Esta en su propia transaccion
    // Si la transaccion exterior hace rollback, el audit se MANTIENE
    auditRepository.save(new AuditLog(action));
}

// NESTED: crea un savepoint dentro de la transaccion existente
// Si NESTED hace rollback, solo revierte hasta el savepoint, no toda la tx
@Transactional(propagation = Propagation.NESTED)
public void partialOperation() { }

// SUPPORTS: si hay transaccion, la usa; si no, ejecuta sin transaccion
@Transactional(propagation = Propagation.SUPPORTS)
public void readOperation() { }

// NEVER: lanza excepcion si hay transaccion activa
@Transactional(propagation = Propagation.NEVER)
public void nonTransactionalOperation() { }

// NOT_SUPPORTED: suspende la transaccion existente, ejecuta sin transaccion
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public void expensiveReport() { } // evita mantener tx durante operacion larga
```

## Niveles de Aislamiento

| Nivel | Dirty Read | Non-Repeatable Read | Phantom Read |
|---|---|---|---|
| READ_UNCOMMITTED | Posible | Posible | Posible |
| READ_COMMITTED (default en PostgreSQL) | Imposible | Posible | Posible |
| REPEATABLE_READ (default en MySQL) | Imposible | Imposible | Posible |
| SERIALIZABLE | Imposible | Imposible | Imposible |

- **Dirty Read**: leer datos que otra transaccion aun no comiteo (y puede hacer rollback)
- **Non-Repeatable Read**: leer la misma fila dos veces en la misma tx y obtener valores distintos (alguien modifico entre lecturas)
- **Phantom Read**: leer el mismo rango dos veces y obtener filas distintas (alguien inserto/elimino entre lecturas)

## La Trampa de @Transactional

```java
@Service
public class OrderService {

    public void processOrders() {
        this.createOrder(); // TRAMPA: llamada interna, no pasa por el proxy AOP
        // @Transactional en createOrder NO aplica
    }

    @Transactional
    public void createOrder() {
        orderRepository.save(new Order());
        // Si esto falla, NO hace rollback porque no hay transaccion activa
    }
}
```

**Por que**: Spring envuelve el bean en un proxy (CGLIB o JDK). Cuando llamas `orderService.createOrder()` desde afuera, pasa por el proxy. Cuando llamas `this.createOrder()` desde adentro, va directamente al objeto, saltandose el proxy.

**Soluciones**:
1. Extraer el metodo a un bean separado
2. Inyectar el servicio en si mismo (`@Autowired private OrderService self`)
3. Usar `@Transactional` en el metodo publico que llama

## Proyecciones

```java
// Interface projection: Spring crea un proxy que mapea getters a columnas
public interface OrderSummary {
    Long getId();
    String getStatus();

    @Value("#{target.firstName + ' ' + target.lastName}") // SpEL
    String getCustomerFullName();
}
List<OrderSummary> findByStatus(OrderStatus status); // solo selecciona esas columnas

// Class projection (DTO): necesita constructor exacto
public record OrderDto(Long id, String status, BigDecimal total) {}
@Query("SELECT new com.example.OrderDto(o.id, o.status, o.total) FROM Order o")
List<OrderDto> findOrderDtos();

// Dynamic projection: mismo metodo, diferente tipo de retorno
<T> Optional<T> findById(Long id, Class<T> type);
// Uso:
orderRepo.findById(1L, OrderSummary.class) // interface projection
orderRepo.findById(1L, Order.class)        // entidad completa
```

## Debilidades de Spring Data JPA

1. **N+1 es silencioso**: ocurre sin warning por default, solo ves en los logs SQL
2. **Metodos derivados complejos**: nombres de 50+ caracteres que nadie entiende
3. **Paginacion con JOIN FETCH**: no funciona bien (Hibernate pagina en memoria)
4. **LazyInitializationException**: acceder a coleccion lazy fuera de la transaccion
5. **Actualizacion parcial**: no tiene soporte nativo para PATCH eficiente (cargas el objeto completo)
6. **Herencia de entidades**: puede generar queries complejas con muchos JOINs

## Curiosidades para Examen Avanzado

1. **`@Transactional` en tests**: los tests anotados con `@Transactional` hacen rollback automatico al terminar el test. Esto significa que la DB queda limpia sin necesitar `@AfterEach`. Pero cuidado: no detectaras problemas de LazyInitializationException porque el test esta en transaccion.

2. **`save()` vs `saveAndFlush()`**: `save()` acumula cambios hasta que Hibernate decide hacer flush (generalmente al final de la transaccion). `saveAndFlush()` fuerza el SQL inmediatamente. Util cuando necesitas el ID generado por la DB antes de continuar.

3. **Dirty Checking**: Hibernate trackea el estado de las entidades cargadas. Si modificas una entidad dentro de una transaccion, Hibernate genera el UPDATE automaticamente al hacer flush, SIN que llames a `save()`. Esto sorprende a muchos.

4. **`@DynamicUpdate`**: por default Hibernate incluye TODAS las columnas en el UPDATE aunque solo cambies una. `@DynamicUpdate` hace que solo actualice las columnas cambiadas (util en tablas con muchas columnas o para evitar conflictos de concurrencia optimista).

5. **Optimistic Locking**: `@Version` en un campo (generalmente `int` o `Long`) hace que Hibernate incluya `WHERE version = ?` en los UPDATEs. Si otro proceso actualizo primero, lanza `OptimisticLockException`.

---

# 5. Spring Security

## Que es

Spring Security es un framework de autenticacion y autorizacion para aplicaciones Spring. Maneja quien eres (autenticacion) y que puedes hacer (autorizacion).

## Por que existe

Sin Spring Security tendrias que:
- Implementar manualmente el parsing de tokens/sessiones en cada request
- Manejar la criptografia de passwords
- Implementar CSRF protection
- Manejar CORS
- Implementar autorización por roles/permisos

Spring Security provee todo esto de forma robusta y auditada.

## Arquitectura Interna

```
Request HTTP
    |
    v
DelegatingFilterProxy (Bridge entre Servlet y Spring)
    |
    v
FilterChainProxy (el corazon de Spring Security)
    |
    v
SecurityFilterChain (cadena de filtros configurables)
    |
    +-> SecurityContextPersistenceFilter (carga/guarda SecurityContext)
    +-> UsernamePasswordAuthenticationFilter (procesa login forms)
    +-> BearerTokenAuthenticationFilter (procesa JWT/OAuth2)
    +-> ExceptionTranslationFilter (maneja AccessDeniedException, AuthenticationException)
    +-> FilterSecurityInterceptor / AuthorizationFilter (verifica permisos)
    |
    v
Tu aplicacion
```

## Configuracion Moderna (Spring Security 6+)

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity // habilita @PreAuthorize, @PostAuthorize, @Secured
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            // Deshabilitar CSRF para APIs REST stateless (no usan cookies de sesion)
            .csrf(AbstractHttpConfigurer::disable)

            // Stateless: no crear sesion HTTP
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // Configurar CORS si es necesario
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // Reglas de autorizacion - orden importa
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/api/public/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/products/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/actuator/**").hasRole("ADMIN")
                .anyRequest().authenticated() // todo lo demas requiere autenticacion
            )

            // Agregar nuestro filtro JWT antes del filtro de autenticacion standard
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

            // Manejo de excepciones de seguridad
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(customAuthEntryPoint()) // 401
                .accessDeniedHandler(customAccessDeniedHandler())  // 403
            )

            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // BCrypt con factor de costo 12 (por default es 10)
        // Factor 12: ~250ms por hash - balance seguridad/rendimiento
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }
}
```

## Implementacion JWT Completa

```java
// Filtro JWT
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws IOException, ServletException {

        // Extraer token del header
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return; // sin token, continuar (puede ser endpoint publico)
        }

        String token = authHeader.substring(7);

        try {
            String username = jwtService.extractUsername(token);

            // Solo procesar si hay username y NO hay autenticacion ya en el contexto
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                if (jwtService.isTokenValid(token, userDetails)) {
                    // Crear token de autenticacion (ya verificado)
                    UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null, // credentials null: ya autenticado
                            userDetails.getAuthorities()
                        );
                    authToken.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                    );
                    // Registrar en el contexto de seguridad del thread actual
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (JwtException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            // No lanzar excepcion, solo no autenticar. El siguiente filtro rechazara si es necesario
        }

        filterChain.doFilter(request, response);
    }
}

// Servicio JWT
@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration:86400000}") // 24 horas por default
    private long expiration;

    public String generateToken(UserDetails userDetails) {
        return generateToken(Map.of(), userDetails);
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        return Jwts.builder()
            .claims(extraClaims)
            .subject(userDetails.getUsername())
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(getSigningKey())
            .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    }
}
```

## UserDetailsService y UserDetails

```java
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        return org.springframework.security.core.userdetails.User.builder()
            .username(user.getEmail())
            .password(user.getPasswordHash()) // ya hasheado en DB
            .roles(user.getRole().name())     // ROLE_ADMIN, ROLE_USER
            .accountLocked(!user.isActive())
            .build();
    }
}
```

## Method Security

```java
@Service
public class OrderService {

    // Verificacion ANTES de ejecutar el metodo
    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
    public List<Order> findByUser(Long userId) {
        return orderRepository.findByUserId(userId);
    }

    // Verificacion DESPUES de ejecutar (tiene acceso al retorno)
    @PostAuthorize("returnObject.userId == authentication.principal.id")
    public Order findById(Long id) {
        return orderRepository.findById(id).orElseThrow();
    }

    // Filtrar coleccion retornada
    @PostFilter("filterObject.userId == authentication.principal.id")
    public List<Order> findAll() {
        return orderRepository.findAll();
    }

    // Filtrar coleccion de entrada
    @PreFilter("filterObject.userId == authentication.principal.id")
    public void updateAll(List<Order> orders) { }

    // Con SpEL mas complejo
    @PreAuthorize("@orderSecurityService.canModify(#orderId, authentication)")
    public void cancel(Long orderId) { }
}

// Servicio de seguridad personalizado
@Service("orderSecurityService")
public class OrderSecurityService {
    public boolean canModify(Long orderId, Authentication auth) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))
            || order.getUserId().equals(((UserDetails) auth.getPrincipal()).getId());
    }
}
```

## SecurityContextHolder

```java
// El SecurityContextHolder usa ThreadLocal por default
// Cada thread tiene su propio SecurityContext

// Obtener usuario actual desde cualquier parte del codigo
public UserDetails getCurrentUser() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
        throw new UnauthorizedException("No authenticated user");
    }
    return (UserDetails) auth.getPrincipal();
}

// En el controller, mas elegante con @AuthenticationPrincipal
@GetMapping("/profile")
public UserDto getProfile(@AuthenticationPrincipal UserDetails userDetails) {
    return userService.findByEmail(userDetails.getUsername());
}
```

## Cuando NO usar ciertos features

- **SessionCreationPolicy.STATELESS + CSRF deshabilitado**: correcto para APIs REST. CSRF solo es necesario cuando usas cookies de sesion con browsers.
- **BCrypt factor muy alto (>14)**: el hash se vuelve muy lento, afecta rendimiento en login.
- **@PreAuthorize en todos los metodos**: puede ser overkill, evalua si los filtros HTTP son suficientes.

## Debilidades

1. **Complejidad de configuracion**: demasiadas opciones y formas de hacer lo mismo
2. **Debugging dificil**: los filtros son invisibles; cuando algo falla en auth, el stack trace no ayuda
3. **ThreadLocal y async**: `SecurityContextHolder` usa ThreadLocal, si usas `@Async` o reactive, el contexto no se propaga automaticamente
4. **JWT sin revocar**: los JWTs no se pueden invalidar facilmente antes de expirar (necesitas blacklist en Redis)
5. **Orden de filtros critico**: si agregas un filtro en el lugar equivocado, el comportamiento es impredecible

## Curiosidades para Examen Avanzado

1. **`SecurityContextHolder.MODE_INHERITABLETHREADLOCAL`**: cambia el mode para que el contexto se propague a threads hijos. Necesario para `@Async` con Spring Security.

2. **PasswordEncoder no es solo BCrypt**: `DelegatingPasswordEncoder` permite multiples algoritmos en paralelo (util para migracion). Los passwords en DB tienen el formato `{bcrypt}$2a$10$...`.

3. **CSRF y SPA**: las SPAs (React, Angular) que usan cookies necesitan CSRF. Las que usan Authorization header con JWT NO necesitan CSRF porque browsers no envian headers custom cross-origin por default.

4. **`@Secured` vs `@PreAuthorize`**: `@Secured` es mas simple pero no soporta SpEL. `@PreAuthorize` es mas potente. Prefiere `@PreAuthorize`.

5. **Authentication vs Authorization**: autenticacion = verificar identidad (quien eres). Autorizacion = verificar permisos (que puedes hacer). Spring Security hace ambas, pero son conceptos distintos.

---

# 6. Spring Boot Actuator y Observabilidad

## Que es

Actuator expone endpoints HTTP (o JMX) que dan visibilidad al estado interno de la aplicacion: salud, metricas, configuracion, threads, y mas. Es esencial para operaciones en produccion.

## Por que existe

En produccion necesitas saber: ¿esta la app sana? ¿consume demasiada memoria? ¿hay threads bloqueados? ¿que version esta corriendo? Sin Actuator tendrias que implementar todo esto manualmente.

## Endpoints Clave

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env,beans,conditions,loggers,threaddump,heapdump,mappings
      base-path: /actuator  # path base (default)
  endpoint:
    health:
      show-details: when-authorized # never | always | when-authorized
      show-components: always
  health:
    diskspace:
      enabled: true
      threshold: 10MB
  # Seguridad: exponer solo health publicamente
  # El resto protegerlo con Spring Security
```

| Endpoint | Que hace | Riesgo si expuesto |
|---|---|---|
| `/actuator/health` | Estado de la app | Bajo |
| `/actuator/info` | Informacion de la app (version, git commit) | Bajo |
| `/actuator/metrics` | Metricas JVM, HTTP, custom | Medio |
| `/actuator/env` | Variables de entorno y PROPIEDADES (passwords!) | ALTO |
| `/actuator/beans` | Todos los beans del contexto | Medio |
| `/actuator/conditions` | Reporte de auto-configuration | Medio |
| `/actuator/loggers` | Ver y CAMBIAR niveles de log en runtime | Medio |
| `/actuator/threaddump` | Estado de todos los threads | Medio |
| `/actuator/heapdump` | Dump del heap (contiene datos sensibles!) | ALTO |
| `/actuator/shutdown` | Apaga la app via HTTP | CRITICO |
| `/actuator/mappings` | Todos los endpoints registrados | Bajo |

**IMPORTANTE**: nunca exponer `/actuator/env`, `/actuator/heapdump`, `/actuator/shutdown` al publico.

## Custom Health Indicator

```java
@Component
public class PaymentGatewayHealthIndicator implements HealthIndicator {

    private final PaymentGatewayClient client;

    @Override
    public Health health() {
        try {
            ResponseEntity<String> response = client.ping();
            if (response.getStatusCode().is2xxSuccessful()) {
                return Health.up()
                    .withDetail("url", client.getBaseUrl())
                    .withDetail("responseTime", "fast")
                    .build();
            } else {
                return Health.down()
                    .withDetail("status", response.getStatusCode())
                    .build();
            }
        } catch (Exception e) {
            return Health.down(e)
                .withDetail("error", e.getMessage())
                .build();
        }
    }
}

// Composite health check
@Component
public class DatabaseHealthIndicator implements HealthIndicator {
    private final DataSource dataSource;

    @Override
    public Health health() {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("SELECT 1");
            return Health.up().withDetail("database", "PostgreSQL").build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }
}
```

## Metricas con Micrometer

Micrometer es la capa de abstraccion de metricas de Spring Boot (como SLF4J pero para metricas). Puede exportar a Prometheus, Datadog, New Relic, CloudWatch, etc.

```java
@Service
public class OrderService {

    private final Counter orderCreatedCounter;
    private final Counter orderFailedCounter;
    private final Timer orderProcessingTimer;
    private final DistributionSummary orderAmountSummary;
    private final AtomicInteger pendingOrders;

    public OrderService(MeterRegistry registry) {
        // Counter: solo sube, nunca baja
        this.orderCreatedCounter = Counter.builder("orders.created")
            .tag("region", "us-east-1")
            .description("Total orders successfully created")
            .register(registry);

        this.orderFailedCounter = Counter.builder("orders.failed")
            .description("Total orders that failed")
            .register(registry);

        // Timer: mide duracion y cuenta
        this.orderProcessingTimer = Timer.builder("orders.processing.duration")
            .description("Time to process an order")
            .publishPercentiles(0.5, 0.95, 0.99) // percentiles
            .register(registry);

        // Distribution summary: como Timer pero para valores arbitrarios
        this.orderAmountSummary = DistributionSummary.builder("orders.amount")
            .description("Distribution of order amounts")
            .baseUnit("dollars")
            .register(registry);

        // Gauge: valor que sube y baja
        this.pendingOrders = registry.gauge("orders.pending",
            new AtomicInteger(0));
    }

    public Order create(CreateOrderRequest request) {
        return orderProcessingTimer.record(() -> {
            try {
                Order order = processOrder(request);
                orderCreatedCounter.increment();
                orderAmountSummary.record(order.getTotal().doubleValue());
                pendingOrders.incrementAndGet();
                return order;
            } catch (Exception e) {
                orderFailedCounter.increment();
                throw e;
            }
        });
    }

    // Anotacion alternativa
    @Timed(value = "order.service.create", percentiles = {0.5, 0.95})
    public Order createWithAnnotation(CreateOrderRequest request) {
        return processOrder(request);
    }
}
```

## Distributed Tracing con Spring Boot 3 (Micrometer Tracing)

```yaml
# Spring Boot 3 integra Micrometer Tracing (reemplaza Spring Cloud Sleuth)
management:
  tracing:
    sampling:
      probability: 0.1  # trazar 10% de requests (en produccion)
  zipkin:
    tracing:
      endpoint: http://zipkin:9411/api/v2/spans
```

```java
// El traceId y spanId se agregan automaticamente a los logs
// Y se propagan via HTTP headers (B3 o W3C TraceContext)

// Span manual para operaciones importantes
@Service
public class OrderService {
    private final Tracer tracer;

    public Order create(CreateOrderRequest request) {
        Span span = tracer.nextSpan().name("process-payment").start();
        try (Tracer.SpanInScope scope = tracer.withSpan(span)) {
            span.tag("orderId", request.getId().toString());
            return paymentService.process(request);
        } finally {
            span.end();
        }
    }
}
```

## Cuando NO usar Actuator

- Nunca exponer `/actuator/env` y `/actuator/heapdump` publicamente (contienen secretos)
- No habilitar `/actuator/shutdown` (apaga la app via HTTP POST)
- En microservicios, asegurarse de que Actuator esta protegido por la red interna o Spring Security

## Debilidades

1. **Seguridad**: los endpoints pueden exponer informacion sensible si no se configuran correctamente
2. **Performance**: el `/actuator/heapdump` puede tardar segundos y congelar la app temporalmente
3. **Overhead de metricas**: registrar demasiadas metricas con muchas etiquetas (tags) puede causar "cardinality explosion" que consume mucha memoria
4. **Dependencia de infraestructura**: para metricas y tracing necesitas Prometheus, Zipkin, etc.

## Curiosidades para Examen Avanzado

1. **`/actuator/loggers` es dinamico**: puedes cambiar el nivel de log de cualquier logger en runtime sin reiniciar la app. Util para debug en produccion.

2. **Cardinality Explosion en metricas**: si usas valores de alta cardinalidad como tags (ej: userId, orderId), cada combinacion unica crea una nueva serie temporal. Con millones de usuarios, Prometheus puede quedarse sin memoria. NUNCA pongas IDs de entidades como tags de metricas.

3. **`/actuator/health` en Kubernetes**: los probes de liveness y readiness de Kubernetes consumen este endpoint. Spring Boot tiene soporte nativo: `/actuator/health/liveness` y `/actuator/health/readiness`.

4. **`spring-boot-admin`**: libreria de terceros (Codecentric) que provee una UI web sobre los endpoints de Actuator para multiples apps.

---

# 7. Configuracion y Propiedades

## @Value vs @ConfigurationProperties

```java
// @Value: para propiedades simples o pocas
@Service
public class EmailService {
    @Value("${email.host}")
    private String host;

    @Value("${email.port:587}") // con valor default
    private int port;

    @Value("${email.enabled:true}")
    private boolean enabled;
}

// @ConfigurationProperties: para grupos de propiedades relacionadas (PREFERIDA)
@ConfigurationProperties(prefix = "email")
@Validated // valida con Bean Validation al arrancar
public record EmailProperties(
    @NotBlank String host,
    @Min(1) @Max(65535) int port,
    boolean enabled,
    @Valid SmtpConfig smtp
) {
    public record SmtpConfig(
        @NotBlank String username,
        @NotBlank String password,
        boolean useTls
    ) {}
}
```

**Por que @ConfigurationProperties es mejor**:
1. Tipo-safe: el IDE te da autocomplete
2. Validacion integrada con `@Validated`
3. Documentacion generada automaticamente (con `spring-boot-configuration-processor`)
4. Mas facil de testear (inyectas el record)
5. Soporta propiedades complejas (listas, mapas, objetos anidados)

## Orden de Precedencia (de mayor a menor prioridad)

```
1. Argumentos de linea de comando: --server.port=8081
2. SPRING_APPLICATION_JSON (env var con JSON)
3. Variables de entorno del SO: SERVER_PORT=8081
4. application-{profile}.properties/yml (en el jar)
5. application.properties/yml (en el jar)
6. @PropertySource en clases @Configuration
7. Propiedades default en SpringApplication
```

**Regla**: mayor numero = mayor prioridad, sobreescribe a los anteriores.

```bash
# Sobrescribir propiedades en produccion sin modificar el jar
java -jar app.jar --spring.datasource.url=jdbc:postgresql://prod-db:5432/mydb
# O con variable de entorno:
export SPRING_DATASOURCE_URL=jdbc:postgresql://prod-db:5432/mydb
java -jar app.jar
```

## Perfiles

```yaml
# application.yml
spring:
  application:
    name: my-service
  jpa:
    show-sql: false  # comun a todos los perfiles

---
# Bloque para perfil dev (en el mismo archivo)
spring:
  config:
    activate:
      on-profile: dev
  datasource:
    url: jdbc:h2:mem:devdb
  jpa:
    show-sql: true

---
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: ${DB_URL}          # variables de entorno en produccion
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    show-sql: false
```

```bash
# Activar perfil
java -jar app.jar --spring.profiles.active=prod
# O:
export SPRING_PROFILES_ACTIVE=prod

# Multiples perfiles
--spring.profiles.active=prod,kafka,monitoring
```

## Configuracion Externalizada con Spring Cloud Config

```yaml
# Para multiples microservicios con configuracion centralizada
spring:
  config:
    import: configserver:http://config-server:8888
  cloud:
    config:
      fail-fast: true  # falla si no puede conectar al config server
      retry:
        max-attempts: 5
```

## Manejo de Secretos

```java
// NUNCA hardcodear secretos en el codigo o en application.yml versionado
// Patrones correctos:

// 1. Variables de entorno
@Value("${DB_PASSWORD}") // viene de la variable de entorno DB_PASSWORD

// 2. Spring Cloud Config con encriptacion
// encrypted: {cipher}AgCVA8...

// 3. Vault (HashiCorp)
spring:
  cloud:
    vault:
      uri: https://vault.example.com
      authentication: TOKEN
      token: ${VAULT_TOKEN}
```

## Debilidades

1. **Propiedades de alta cardinalidad**: si usas `@Value` con SpEL complejo, es dificil de testear
2. **Sin validacion en `@Value`**: `@Value` no valida; si la propiedad no existe y no hay default, falla en runtime con `IllegalArgumentException`
3. **Rotacion de secretos**: cambiar un secreto requiere reiniciar la app (a menos que uses Spring Cloud Config con refresh)
4. **Tipeo erroneo**: `${my.prperty}` (typo) falla silenciosamente o con error confuso

## Curiosidades para Examen Avanzado

1. **Relaxed binding**: Spring Boot acepta `myProperty`, `my-property`, `MY_PROPERTY`, `MY_PROPERTY` todos como equivalentes. Esto facilita usar variables de entorno del SO (que suelen ser uppercase con underscores) para propiedades camelCase.

2. **`@RefreshScope`**: con Spring Cloud, permite que un bean recargue sus propiedades sin reiniciar la app cuando llamas `POST /actuator/refresh`.

3. **`spring-boot-configuration-processor`**: dependencia de compile-time que genera metadata de tus `@ConfigurationProperties`. Esto hace que el IDE muestre autocomplete y documentacion en `application.yml`.

---

# 8. Spring AOP (Aspect-Oriented Programming)

## Que es

AOP es un paradigma de programacion que permite separar concerns transversales (cross-cutting concerns) del codigo de negocio. Un concern transversal es logica que se repite en multiples clases: logging, seguridad, transacciones, cache, metricas.

## Por que existe

Sin AOP tendrias esto:
```java
public class OrderService {
    public Order create(CreateOrderRequest request) {
        log.info("Entering create"); // logging repetido
        checkPermissions(); // seguridad repetida
        long start = System.currentTimeMillis(); // metricas repetidas
        try {
            Order order = /* logica de negocio */;
            metrics.increment("orders.created"); // metricas repetidas
            return order;
        } catch (Exception e) {
            log.error("Error in create", e); // logging repetido
            throw e;
        } finally {
            log.info("Exiting create, took {}ms", ...); // logging repetido
        }
    }
    // + 20 metodos mas con el mismo boilerplate
}
```

Con AOP el boilerplate se extrae a un Aspect y el codigo de negocio queda limpio.

## Conceptos Fundamentales

- **Aspect**: la clase que contiene la logica transversal (ej: `LoggingAspect`)
- **Advice**: CUANDO ejecutar y QUE hacer (Before, After, Around, AfterReturning, AfterThrowing)
- **Pointcut**: expresion que define DONDE aplicar el advice (en que metodos)
- **Join Point**: punto especifico en la ejecucion del programa donde el advice se aplica
- **Weaving**: el proceso de aplicar los aspects al codigo objetivo

## Tipos de Advice

```java
@Aspect
@Component
public class AuditAspect {

    // Pointcut reutilizable
    @Pointcut("execution(* com.example.service.*Service.*(..))")
    public void serviceLayer() {}

    // BEFORE: se ejecuta ANTES del metodo
    @Before("serviceLayer()")
    public void logBefore(JoinPoint jp) {
        log.info("Calling: {}.{}",
            jp.getTarget().getClass().getSimpleName(),
            jp.getSignature().getName());
    }

    // AFTER RETURNING: solo si el metodo retorna normalmente
    @AfterReturning(pointcut = "serviceLayer()", returning = "result")
    public void logSuccess(JoinPoint jp, Object result) {
        log.info("{} returned: {}", jp.getSignature().getName(), result);
    }

    // AFTER THROWING: solo si el metodo lanza excepcion
    @AfterThrowing(pointcut = "serviceLayer()", throwing = "ex")
    public void logException(JoinPoint jp, Exception ex) {
        log.error("{} threw: {}", jp.getSignature().getName(), ex.getMessage());
    }

    // AFTER (Finally): siempre se ejecuta, con o sin excepcion
    @After("serviceLayer()")
    public void logAfter(JoinPoint jp) {
        log.info("Exited: {}", jp.getSignature().getName());
    }

    // AROUND: el mas poderoso - envuelve completamente el metodo
    @Around("serviceLayer()")
    public Object measure(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        try {
            Object result = pjp.proceed(); // DEBES llamar proceed() para ejecutar el metodo
            log.info("{} took {}ms", pjp.getSignature().getName(),
                System.currentTimeMillis() - start);
            return result;
        } catch (Exception e) {
            log.error("{} failed after {}ms", pjp.getSignature().getName(),
                System.currentTimeMillis() - start);
            throw e; // re-lanzar para no swallow exceptions
        }
    }
}
```

## Sintaxis de Pointcut

```java
// execution(modificador? tipoRetorno paquete.clase.metodo(parametros) excepciones?)
@Pointcut("execution(* com.example.service.*.*(..))")
// Cualquier modificador, cualquier retorno, cualquier clase en service, cualquier metodo, cualquier param

@Pointcut("execution(public * com.example..*Service.find*(..))")
// Solo publicos, cualquier retorno, cualquier subpaquete de example, clases que terminan en Service, metodos que empiezan con find

@Pointcut("within(com.example.service..*)")
// Cualquier metodo en cualquier clase dentro del paquete service (recursivo)

@Pointcut("@annotation(org.springframework.transaction.annotation.Transactional)")
// Cualquier metodo anotado con @Transactional

@Pointcut("@within(org.springframework.stereotype.Service)")
// Cualquier metodo en cualquier clase anotada con @Service

@Pointcut("bean(*Service)")
// Cualquier bean cuyo nombre termine en Service

// Combinar pointcuts
@Pointcut("serviceLayer() && !within(com.example.internal..*)")
public void externalService() {}
```

## JDK Proxy vs CGLIB

```
JDK Dynamic Proxy:
- Funciona solo si el bean IMPLEMENTA una interfaz
- Crea un proxy que implementa la misma interfaz
- Usa java.lang.reflect.Proxy

CGLIB Proxy:
- Funciona con clases concretas (sin interfaz)
- Crea una SUBCLASE en runtime
- Spring Boot usa CGLIB por default desde Spring 4
```

**Implicaciones**:
- La clase no puede ser `final` (no se puede hacer subclase)
- Los metodos no pueden ser `final` (no se pueden sobreescribir)
- Self-invocation no funciona (llamar `this.metodo()` no pasa por el proxy)

## Solucionar Self-Invocation

```java
// PROBLEMA
@Service
public class OrderService {
    public void processAll() {
        this.processOne(); // no pasa por el proxy, @Transactional no aplica
    }

    @Transactional
    public void processOne() { }
}

// SOLUCION 1: refactorizar a otro bean
@Service
public class OrderProcessor {
    @Transactional
    public void processOne() { }
}

@Service
public class OrderService {
    private final OrderProcessor processor;

    public void processAll() {
        processor.processOne(); // ahora si pasa por el proxy
    }
}

// SOLUCION 2: ApplicationContext (feo pero funciona)
@Service
public class OrderService implements ApplicationContextAware {
    private ApplicationContext context;

    public void processAll() {
        OrderService self = context.getBean(OrderService.class); // el proxy
        self.processOne(); // pasa por el proxy
    }
}
```

## Debilidades de AOP

1. **Self-invocation**: la limitacion mas importante y mas frecuente en entrevistas
2. **Metodos privados**: no se pueden interceptar (el proxy no los puede sobreescribir)
3. **Clases final**: CGLIB no puede crear subclases de clases finales
4. **Debugging complejo**: el stack trace incluye clases generadas dinamicamente
5. **Overhead de performance**: cada llamada interceptada tiene un pequeno overhead por la reflection
6. **Orden de aspects**: si hay multiples aspects en el mismo metodo, el orden puede ser inesperado (usa `@Order`)

## Curiosidades para Examen Avanzado

1. **`@Transactional` es AOP**: las transacciones de Spring SON implementadas con AOP. El proxy intercepta la llamada, abre la transaccion, ejecuta el metodo, y commit/rollback.

2. **AspectJ vs Spring AOP**: Spring AOP usa proxies (runtime weaving solo en metodos publicos de beans Spring). AspectJ hace weaving en bytecode (compilacion o carga), funciona en cualquier lugar. Spring puede usar AspectJ para casos que Spring AOP no puede manejar.

3. **`@EnableAspectJAutoProxy(proxyTargetClass = true)`**: fuerza el uso de CGLIB aunque haya interfaz. Spring Boot lo activa por default.

4. **Aspect ordering**: con `@Order(1)`, el aspect con menor numero envuelve al de mayor numero. Si tienes `@Order(1)` logging y `@Order(2)` security, logging envuelve a security: el orden de ejecucion es: logging-before -> security-before -> metodo -> security-after -> logging-after.

---

# 9. Spring Cache

## Que es

Spring Cache es una abstraccion para agregar caching a metodos de Spring sin escribir codigo de caching explicito. Usa AOP para interceptar llamadas a metodos y retornar resultados cacheados.

## Por que existe

Sin Spring Cache:
```java
public Product findById(Long id) {
    // logica de cache manual con Redis/Caffeine/etc.
    String key = "product:" + id;
    Product cached = redisTemplate.opsForValue().get(key);
    if (cached != null) return cached;

    Product product = repository.findById(id).orElseThrow();
    redisTemplate.opsForValue().set(key, product, Duration.ofMinutes(10));
    return product;
}
```

Con Spring Cache:
```java
@Cacheable(value = "products", key = "#id")
public Product findById(Long id) {
    return repository.findById(id).orElseThrow();
}
```

## Anotaciones

```java
@Service
public class ProductService {

    // Cacheable: si el resultado esta en cache, retorna directamente sin ejecutar el metodo
    @Cacheable(
        value = "products",           // nombre del cache
        key = "#id",                  // clave (SpEL)
        condition = "#id > 0",        // solo cachear si condicion se cumple
        unless = "#result == null"    // no cachear si resultado es null
    )
    public Product findById(Long id) {
        return repository.findById(id).orElseThrow();
    }

    // Cacheable con clave compuesta
    @Cacheable(value = "productSearch", key = "#category + '-' + #page")
    public Page<Product> findByCategory(String category, int page) {
        return repository.findByCategory(category, PageRequest.of(page, 20));
    }

    // CachePut: siempre ejecuta el metodo Y actualiza el cache
    @CachePut(value = "products", key = "#product.id")
    public Product update(Product product) {
        return repository.save(product);
    }

    // CacheEvict: elimina entradas del cache
    @CacheEvict(value = "products", key = "#id")
    public void delete(Long id) {
        repository.deleteById(id);
    }

    // Evict todo el cache
    @CacheEvict(value = "products", allEntries = true)
    public void clearAll() { }

    // Caching: multiple anotaciones en un metodo
    @Caching(
        cacheable = @Cacheable(value = "productByName", key = "#name"),
        put = @CachePut(value = "products", key = "#result.id")
    )
    public Product findByName(String name) {
        return repository.findByName(name).orElseThrow();
    }
}
```

## Configuracion con Redis

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        // Configuracion default
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues(); // no cachear nulls

        // Configuraciones por cache especifico
        Map<String, RedisCacheConfiguration> cacheConfigs = new HashMap<>();
        cacheConfigs.put("products", defaultConfig.entryTtl(Duration.ofHours(1)));
        cacheConfigs.put("sessions", defaultConfig.entryTtl(Duration.ofMinutes(30)));

        return RedisCacheManager.builder(factory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(cacheConfigs)
            .build();
    }
}
```

## Configuracion con Caffeine (cache en memoria, mas rapido)

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager("products", "categories");
        manager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(1000)                    // maximo 1000 entradas
            .expireAfterWrite(10, TimeUnit.MINUTES)
            .expireAfterAccess(5, TimeUnit.MINUTES) // evict si no se accede en 5 min
            .recordStats()                        // estadisticas de hit/miss
        );
        return manager;
    }
}
```

## @Cacheable vs @CachePut

| | @Cacheable | @CachePut |
|---|---|---|
| Ejecuta el metodo | Solo si no hay cache hit | Siempre |
| Uso | Lecturas | Escrituras que deben actualizar cache |
| Retorna | Valor del cache o del metodo | Siempre el valor del metodo |

## Cuando NO usar Cache

- Datos que cambian frecuentemente (invalidacion costosa)
- Datos por usuario con muchos usuarios (memoria)
- Operaciones de escritura (salvo `@CachePut`)
- Ambientes de desarrollo (puede ocultar bugs)
- Cuando la operacion es mas rapida que el overhead del cache

## Debilidades

1. **Cache stampede**: si el cache expira y muchos threads intentan regenerarlo al mismo tiempo, todos van a la DB. Solucion: Caffeine tiene `refreshAfterWrite` que renueva en background.
2. **Invalidacion**: "There are only two hard things in CS: cache invalidation and naming things"
3. **Datos inconsistentes**: entre actualizacion y expiracion del cache, el dato puede estar stale
4. **Serializacion**: objetos en Redis deben ser serializables. Si cambias la clase, los datos viejos pueden fallar al deserializarse.
5. **Self-invocation**: `@Cacheable` tampoco funciona en llamadas internas (mismo problema que AOP)

## Curiosidades para Examen Avanzado

1. **Cache en tests**: `@SpringBootTest` con caches puede dar resultados inesperados entre tests. Usar `@CacheEvict` o `@DirtiesContext` o `SimpleCacheManager` en tests.

2. **Estadisticas de Caffeine**: `cache.stats()` retorna hit rate, miss rate, eviction count. Util para monitorear efectividad del cache.

3. **`unless` vs `condition`**: `condition` se evalua ANTES del metodo (no tiene acceso al resultado). `unless` se evalua DESPUES y puede usar `#result`.

4. **Multi-nivel**: puedes combinar L1 (Caffeine, rapido, en memoria local) y L2 (Redis, compartido entre instancias). Requiere implementacion custom.

---

# 10. Spring Events

## Que es

Spring Events es un mecanismo publish-subscribe dentro de la aplicacion Spring. Un componente publica un evento; otros componentes lo escuchan y reaccionan.

## Por que existe

Desacoplar componentes. Si `OrderService` necesita enviar email, notificar inventario y actualizar estadisticas cuando se crea un pedido:

```java
// SIN eventos: alto acoplamiento
public class OrderService {
    private final EmailService emailService;
    private final InventoryService inventoryService;
    private final StatisticsService statisticsService;

    public Order create(CreateOrderRequest request) {
        Order order = save(request);
        emailService.sendConfirmation(order);       // acoplado
        inventoryService.reduce(order);             // acoplado
        statisticsService.recordSale(order);        // acoplado
        return order;
    }
}

// CON eventos: OrderService no sabe quienes escuchan
public class OrderService {
    private final ApplicationEventPublisher publisher;

    public Order create(CreateOrderRequest request) {
        Order order = save(request);
        publisher.publishEvent(new OrderCreatedEvent(order, Instant.now()));
        return order;
    }
}
```

## Implementacion Completa

```java
// 1. Evento (POJO o record)
public record OrderCreatedEvent(
    Order order,
    Instant occurredAt,
    String correlationId
) {}

// 2. Publisher
@Service
@RequiredArgsConstructor
public class OrderService {
    private final ApplicationEventPublisher publisher;
    private final OrderRepository repository;

    @Transactional
    public Order create(CreateOrderRequest request) {
        Order order = repository.save(new Order(request));
        // El evento se publica dentro de la misma transaccion
        publisher.publishEvent(new OrderCreatedEvent(order, Instant.now(), UUID.randomUUID().toString()));
        return order;
    }
}

// 3. Listeners
@Component
public class OrderNotificationListener {

    // Sincrono: mismo thread, misma transaccion que el publisher
    @EventListener
    public void handleSync(OrderCreatedEvent event) {
        // CUIDADO: si lanza excepcion, hace rollback de la transaccion del publisher
        log.info("Order created: {}", event.order().getId());
    }

    // Asincrono: thread separado del pool @Async
    @EventListener
    @Async
    public void handleAsync(OrderCreatedEvent event) {
        // Se ejecuta en paralelo, no bloquea el caller
        // La transaccion del publisher ya termino (puede o no estar committed)
        emailService.sendConfirmation(event.order());
    }

    // Solo si la transaccion commiteó exitosamente (el mas importante!)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAfterCommit(OrderCreatedEvent event) {
        // GARANTIA: la orden ya esta en la DB
        // Si el publisher hace rollback, este listener NO se ejecuta
        kafkaProducer.publish("orders.created", event);
    }

    // Antes del commit (todavia dentro de la transaccion)
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void handleBeforeCommit(OrderCreatedEvent event) {
        // Puede participar en la misma transaccion
        // Util para validaciones o pre-procesamiento
    }

    // Si la transaccion hace rollback
    @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
    public void handleRollback(OrderCreatedEvent event) {
        log.warn("Order creation rolled back: {}", event.order().getId());
        alertService.notifyFailure(event);
    }
}
```

## TransactionPhase - El Mas Importante

```
BEFORE_COMMIT   -> dentro de la tx, antes del commit
AFTER_COMMIT    -> la tx commito exitosamente (lo mas comun y seguro)
AFTER_ROLLBACK  -> la tx hizo rollback
AFTER_COMPLETION-> siempre, despues de que la tx termina (commit o rollback)
```

**Trampa**: `@TransactionalEventListener` por default NO puede participar en una transaccion nueva. Si necesitas hacer escrituras en la DB en `AFTER_COMMIT`, necesitas `@Transactional(propagation = REQUIRES_NEW)`.

## Eventos de Spring Framework

Spring tiene eventos internos que puedes escuchar:

```java
@Component
public class ApplicationEventListener {

    // Contexto completamente inicializado y listo
    @EventListener(ApplicationReadyEvent.class)
    public void onAppReady() {
        log.info("Application is ready to serve requests");
        warmupCache(); // cargar cache al arrancar
    }

    // Antes de que el contexto cierre
    @EventListener(ContextClosedEvent.class)
    public void onShutdown() {
        log.info("Application is shutting down");
        cleanupResources();
    }

    // Cuando cambia el perfil activo
    @EventListener
    public void onProfileChange(ContextRefreshedEvent event) { }
}
```

## Cuando usar Events

- Cuando quieres desacoplar el publisher de los listeners
- Cuando multiples componentes deben reaccionar al mismo evento
- Cuando la logica es secundaria al flujo principal (notificaciones, auditorias)

## Cuando NO usar Events

- Cuando necesitas la respuesta del listener en el publisher (usa metodo directo)
- Para comunicacion entre microservicios (usa Kafka, RabbitMQ)
- Cuando el orden de ejecucion de los listeners es critico y complejo

## Debilidades

1. **Debugging**: el flujo de eventos es implicito, dificil de seguir
2. **Error handling**: si un listener sincrono lanza excepcion, puede afectar el publisher
3. **Transacciones y async**: `@Async` + `@TransactionalEventListener` requiere cuidado (necesitas `REQUIRES_NEW`)
4. **Sin garantia de entrega**: si la app cae entre el publish y el procesamiento del listener, el evento se pierde. Para garantia de entrega usa Kafka o RabbitMQ con persistencia.

## Curiosidades para Examen Avanzado

1. **Outbox Pattern**: para garantia de entrega, guardar el evento en la DB en la misma transaccion y luego publicarlo a Kafka desde un proceso separado. Con `@TransactionalEventListener(AFTER_COMMIT)` puedes implementar esto.

2. **`@EventListener` puede filtrar**: `@EventListener(condition = "#event.order.total > 1000")` solo procesa eventos que cumplan la condicion.

3. **`@EventListener` puede retornar un nuevo evento**: si el listener retorna un objeto, Spring lo publica como un nuevo evento automaticamente. Permite cadenas de eventos.

---

# 11. Testing en Spring Boot

## Piramide de Testing

```
        /\
       /  \  E2E Tests (pocos, lentos, costosos)
      /----\
     /      \  Integration Tests (algunos)
    /--------\
   /          \  Unit Tests (muchos, rapidos, baratos)
  /____________\
```

## Unit Tests (Sin Spring)

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository repository;

    @Mock
    private PaymentService paymentService;

    @InjectMocks
    private OrderService service;

    @Captor
    private ArgumentCaptor<Order> orderCaptor;

    @Test
    void shouldCreateOrderSuccessfully() {
        // Given
        CreateOrderRequest request = new CreateOrderRequest("user@example.com", BigDecimal.TEN);
        Order savedOrder = new Order(1L, "user@example.com", BigDecimal.TEN, OrderStatus.PENDING);
        when(repository.save(any(Order.class))).thenReturn(savedOrder);

        // When
        Order result = service.create(request);

        // Then
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getStatus()).isEqualTo(OrderStatus.PENDING);

        // Verificar que el repositorio fue llamado con los datos correctos
        verify(repository).save(orderCaptor.capture());
        assertThat(orderCaptor.getValue().getEmail()).isEqualTo("user@example.com");

        // Verificar que paymentService NO fue llamado (pedido aun pendiente)
        verifyNoInteractions(paymentService);
    }

    @Test
    void shouldThrowExceptionWhenRepositoryFails() {
        when(repository.save(any())).thenThrow(new DataIntegrityViolationException("Duplicate email"));

        assertThatThrownBy(() -> service.create(request))
            .isInstanceOf(OrderCreationException.class)
            .hasMessageContaining("Failed to create order");
    }
}
```

## @WebMvcTest - Solo Capa Web

```java
@WebMvcTest(OrderController.class) // solo instancia el controller y MVC config
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean // reemplaza el bean en el contexto de Spring
    private OrderService orderService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldReturn200WithOrderWhenFound() throws Exception {
        OrderDto dto = new OrderDto(1L, "PENDING", BigDecimal.TEN);
        when(orderService.findById(1L)).thenReturn(dto);

        mockMvc.perform(get("/api/orders/1")
                .header("Authorization", "Bearer " + validToken())
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.total").value(10));
    }

    @Test
    void shouldReturn404WhenOrderNotFound() throws Exception {
        when(orderService.findById(99L)).thenThrow(new OrderNotFoundException(99L));

        mockMvc.perform(get("/api/orders/99"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void shouldReturn400WhenRequestBodyInvalid() throws Exception {
        CreateOrderRequest invalidRequest = new CreateOrderRequest("", null); // campos obligatorios vacios

        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
}
```

## @DataJpaTest - Solo Capa de Datos

```java
@DataJpaTest // configura H2 en memoria, solo beans JPA
@AutoConfigureTestDatabase(replace = Replace.NONE) // usar config real de DB (con Testcontainers)
class OrderRepositoryTest {

    @Autowired
    private TestEntityManager entityManager; // helper para setup de datos

    @Autowired
    private OrderRepository repository;

    @Test
    void shouldFindOrdersByStatus() {
        // Setup
        Order pending = entityManager.persistAndFlush(
            new Order("user1@example.com", BigDecimal.TEN, OrderStatus.PENDING));
        Order completed = entityManager.persistAndFlush(
            new Order("user2@example.com", BigDecimal.valueOf(20), OrderStatus.COMPLETED));

        // Execute
        List<Order> result = repository.findByStatus(OrderStatus.PENDING);

        // Assert
        assertThat(result)
            .hasSize(1)
            .extracting(Order::getEmail)
            .containsExactly("user1@example.com");
    }

    @Test
    void shouldFindOrderWithItemsUsingJoinFetch() {
        Order order = new Order("user@example.com", BigDecimal.TEN, OrderStatus.PENDING);
        order.addItem(new OrderItem("Product A", 2, BigDecimal.valueOf(5)));
        entityManager.persistAndFlush(order);
        entityManager.clear(); // limpiar el primer nivel de cache

        Optional<Order> result = repository.findByIdWithItems(order.getId());

        assertThat(result).isPresent();
        assertThat(result.get().getItems()).hasSize(1);
        // No LazyInitializationException porque usamos JOIN FETCH
    }
}
```

## @SpringBootTest - Integration Tests

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = Replace.NONE) // NO reemplazar con H2
@Testcontainers
@ActiveProfiles("test")
class OrderIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private OrderRepository orderRepository;

    @BeforeEach
    void cleanDatabase() {
        orderRepository.deleteAll();
    }

    @Test
    void shouldCreateOrderEndToEnd() {
        CreateOrderRequest request = new CreateOrderRequest("user@example.com", BigDecimal.TEN);

        ResponseEntity<OrderDto> response = restTemplate.postForEntity(
            "/api/orders", request, OrderDto.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().id()).isNotNull();

        // Verificar que se persisto en la DB
        Optional<Order> saved = orderRepository.findById(response.getBody().id());
        assertThat(saved).isPresent();
        assertThat(saved.get().getEmail()).isEqualTo("user@example.com");
    }
}
```

## @MockBean vs @Mock

| | @Mock (Mockito) | @MockBean (Spring) |
|---|---|---|
| Framework | Mockito puro | Spring Test |
| Contexto de Spring | No necesita | Reemplaza el bean en el contexto |
| Velocidad | Muy rapido | Mas lento (carga contexto) |
| Uso | Unit tests sin Spring | Slice tests (@WebMvcTest) o integration |
| Lifecycle | Por test | Por contexto de Spring |

## @SpyBean vs @Spy

```java
// @Spy (Mockito): espiar objeto real, sobreescribir metodos especificos
@Spy
private OrderRepository realRepository = new OrderRepositoryImpl();

@Test
void test() {
    doReturn(Optional.empty()).when(realRepository).findById(99L); // sobreescribir uno
    // los demas metodos usan la implementacion real
}

// @SpyBean (Spring): espiar el bean real del contexto de Spring
@SpyBean
private EmailService emailService; // bean real, pero puedes verificar llamadas y sobreescribir

@Test
void test() {
    orderService.create(request); // usa el EmailService real
    verify(emailService).sendConfirmation(any()); // verificar que se llamo
}
```

## Anotaciones Utiles

```java
// Ejecutar SQL antes del test
@Sql("/test-data/orders.sql")
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class MyTest { }

// Reiniciar el contexto de Spring (muy lento, usar con moderacion)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class MyTest { }

// Propiedades especificas para el test
@TestPropertySource(properties = {
    "feature.x.enabled=true",
    "email.host=localhost"
})
class MyTest { }

// Profile especifico
@ActiveProfiles("test")
class MyTest { }
```

## Debilidades del Testing en Spring

1. **@SpringBootTest es lento**: carga el contexto completo. Los slice tests (@WebMvcTest, @DataJpaTest) son mucho mas rapidos.
2. **Cache de contexto**: Spring intenta reutilizar el ApplicationContext entre tests. `@DirtiesContext` o `@MockBean` invalidan el cache, haciendo los tests lentos.
3. **Testcontainers**: docker debe estar corriendo, agrega tiempo de startup.
4. **Tests con @Transactional**: hacen rollback automaticamente. Esto es util pero puede ocultar problemas de LazyInit.

## Curiosidades para Examen Avanzado

1. **Context caching**: Spring cachea el `ApplicationContext` entre tests con la misma configuracion. Si usas `@MockBean` diferente en cada test, crea un nuevo contexto para cada uno. Centraliza `@MockBean` en una clase base para maximizar el cache.

2. **`@SpringBootTest` sin `webEnvironment`**: por default usa `MOCK` (MockMvc, sin servidor real). `RANDOM_PORT` levanta un servidor Tomcat real en un puerto aleatorio.

3. **TestContainers con `@Container static`**: el contenedor se levanta UNA VEZ para toda la clase de test (mas eficiente). Sin `static`, se levanta por cada metodo.

4. **`RestAssured` vs `MockMvc`**: MockMvc es mas rapido (no usa red), RestAssured es mas natural para E2E y permite probar contra un servidor real.

---

# 12. Spring Boot con Kafka

## Que es Apache Kafka

Kafka es un sistema de mensajeria distribuida basado en logs. Los productores escriben mensajes a topicos; los consumidores los leen a su propio ritmo. Los mensajes se retienen por un periodo configurable (por default 7 dias).

## Por que Kafka y no RabbitMQ

| | Kafka | RabbitMQ |
|---|---|---|
| Modelo | Log distribuido | Cola de mensajes |
| Retension | Configurable (dias/semanas) | Hasta que se consume |
| Throughput | Millones de msg/seg | Miles de msg/seg |
| Replay | Si (leer desde offset anterior) | No |
| Ordenamiento | Por particion | Por cola |
| Uso tipico | Event sourcing, streaming, alta escala | Workflows, RPC, cola de tareas |

## Conceptos Clave de Kafka

- **Topic**: categoria de mensajes (como una tabla en DB)
- **Partition**: subdivision de un topic (paralelismo, ordenamiento por particion)
- **Offset**: posicion del mensaje dentro de una particion (como un indice)
- **Consumer Group**: grupo de consumidores que comparten el trabajo de leer un topic
- **Broker**: servidor de Kafka
- **Replication Factor**: cuantas copias de cada particion existen (durabilidad)

## Configuracion Spring Boot Kafka

```java
// Producer config
@Configuration
public class KafkaProducerConfig {

    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);

        // Durabilidad
        props.put(ProducerConfig.ACKS_CONFIG, "all"); // esperar confirmacion de todos los replicas
        props.put(ProducerConfig.RETRIES_CONFIG, 3);

        // Exactamente una vez (idempotencia)
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);

        // Rendimiento
        props.put(ProducerConfig.BATCH_SIZE_CONFIG, 16384); // 16KB
        props.put(ProducerConfig.LINGER_MS_CONFIG, 10); // esperar 10ms para acumular batch

        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }
}

// Consumer config
@Configuration
public class KafkaConsumerConfig {

    @Bean
    public ConsumerFactory<String, Object> consumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "my-service");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);

        // Offset management
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest"); // desde el principio si no hay offset
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false); // commit manual (mas control)

        // Desempenio
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 100); // maximo mensajes por poll

        return new DefaultKafkaConsumerFactory<>(props);
    }
}
```

## Producer

```java
@Service
@RequiredArgsConstructor
public class OrderEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public CompletableFuture<SendResult<String, Object>> publish(OrderCreatedEvent event) {
        // La clave determina la particion (mismo orderId -> misma particion -> orden garantizado)
        String key = event.orderId().toString();

        return kafkaTemplate.send("orders.created", key, event)
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish event for order {}", event.orderId(), ex);
                } else {
                    RecordMetadata metadata = result.getRecordMetadata();
                    log.info("Event published: topic={}, partition={}, offset={}",
                        metadata.topic(), metadata.partition(), metadata.offset());
                }
            });
    }

    // Transaccional (exactly-once semantics)
    @Transactional("kafkaTransactionManager")
    public void publishTransactionally(OrderCreatedEvent event) {
        kafkaTemplate.send("orders.created", event.orderId().toString(), event);
        kafkaTemplate.send("audit.log", "ORDER_CREATED", event.orderId());
        // Si cualquier send falla, ambos hacen rollback
    }
}
```

## Consumer

```java
@Service
public class OrderEventConsumer {

    @KafkaListener(
        topics = "orders.created",
        groupId = "notification-service",
        concurrency = "3" // 3 threads consumiendo en paralelo (maximo = numero de particiones)
    )
    public void consume(
            @Payload OrderCreatedEvent event,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
            @Header(KafkaHeaders.OFFSET) long offset,
            Acknowledgment ack) {

        log.info("Received event from topic={}, partition={}, offset={}", topic, partition, offset);

        try {
            notificationService.sendOrderConfirmation(event);
            ack.acknowledge(); // commit manual del offset
        } catch (RetryableException e) {
            log.warn("Retryable error, will retry: {}", e.getMessage());
            // NO hacer ack -> Kafka reentregara el mensaje
            throw e;
        } catch (NonRetryableException e) {
            log.error("Non-retryable error, sending to DLT", e);
            ack.acknowledge(); // ack para no bloquear la particion
            // Enviar manualmente al DLT (Dead Letter Topic)
        }
    }

    // Con retry automatico
    @RetryableTopic(
        attempts = "3",
        backoff = @Backoff(delay = 1000, multiplier = 2), // 1s, 2s, 4s
        dltTopicSuffix = ".dlt"
    )
    @KafkaListener(topics = "orders.created", groupId = "inventory-service")
    public void consumeWithRetry(@Payload OrderCreatedEvent event) {
        inventoryService.reduce(event);
        // Si lanza excepcion, Spring Kafka reintenta automaticamente
        // Despues de agotar intentos, va al DLT: orders.created.dlt
    }

    // Listener del DLT
    @DltHandler
    public void handleDlt(OrderCreatedEvent event, Exception ex) {
        log.error("Message sent to DLT after all retries failed", ex);
        alertService.sendAlert("Failed to process order: " + event.orderId());
    }
}
```

## Garantias de Entrega

| Semantica | Descripcion | Configuracion |
|---|---|---|
| At-most-once | Puede perder mensajes, no duplica | `acks=0`, no retry |
| At-least-once | No pierde, puede duplicar | `acks=all`, retry, manual ack |
| Exactly-once | No pierde, no duplica | `enable.idempotence=true`, transacciones |

## Debilidades de Kafka con Spring

1. **Complejidad de configuracion**: muchas propiedades con comportamientos sutiles
2. **Debugging dificil**: rastrear un mensaje a traves de multiples topicos y servicios es complejo
3. **Ordenamiento**: garantizado POR particion, no globalmente. Si rebalanceas, puede cambiar el consumidor de una particion
4. **Deserializacion**: si el schema del mensaje cambia, los consumidores pueden fallar (usar Schema Registry con Avro/Protobuf)
5. **Idempotencia del consumidor**: "at-least-once" significa que el consumidor puede recibir el mismo mensaje dos veces. El consumidor debe ser idempotente.

## Curiosidades para Examen Avanzado

1. **Consumer Group rebalancing**: cuando un nuevo consumidor entra o sale del grupo, Kafka reasigna particiones. Durante el rebalancing, el consumo se pausa. Con Kafka 2.4+ hay rebalancing cooperativo incremental que minimiza la pausa.

2. **Lag del consumidor**: el "consumer lag" es la diferencia entre el offset mas reciente del productor y el offset del consumidor. Si el lag crece, el consumidor no puede seguir el ritmo del productor. Monitorear con `kafka-consumer-groups.sh` o Micrometer.

3. **`@KafkaListener` batch mode**: puede configurarse para recibir `List<ConsumerRecord>` en lugar de uno a la vez, mejorando el throughput.

4. **Schema Registry**: para evitar problemas de compatibilidad de schema entre productor y consumidor, usar Confluent Schema Registry con Avro o Protobuf. Spring Cloud Schema Registry lo integra.

5. **Transactional Outbox Pattern con Kafka**: en lugar de publicar directamente a Kafka en la misma transaccion de DB (diferentes sistemas), guardar el evento en una tabla `outbox` en la misma transaccion, y un proceso separado (o Debezium) publica a Kafka. Garantiza exactamente una entrega.

---

# Preguntas Trampa Clasicas - Respuestas Completas

## 1. ¿Cuándo NO funciona @Transactional?

```java
// CASO 1: Self-invocation - el mas comun
@Service
public class OrderService {
    public void processAll() {
        this.createOrder(); // no pasa por el proxy AOP -> no hay transaccion
    }
    @Transactional
    public void createOrder() { }
}

// CASO 2: Metodos privados
@Service
public class OrderService {
    @Transactional
    private void createOrder() { } // Spring no puede sobrescribir metodos privados con CGLIB
}

// CASO 3: Excepciones checked - NO hace rollback por default
@Transactional // rollback SOLO para RuntimeException y Error
public void create() throws IOException {
    repository.save(order);
    throw new IOException("file error"); // NO hace rollback!
}
// Solucion:
@Transactional(rollbackFor = Exception.class) // rollback para todas las excepciones

// CASO 4: Clase no es un bean de Spring
public class OrderHelper { // no tiene @Component, @Service, etc.
    @Transactional // ignorado completamente
    public void create() { }
}
```

## 2. ¿Diferencia entre @Component, @Service, @Repository, @Controller?

Funcionalmente, los cuatro son `@Component`. La diferencia:

- **`@Repository`**: activa la traduccion de excepciones de persistencia. `SQLException`, `HibernateException`, etc. se convierten en `DataAccessException` (jerarquia de Spring). Permite codigo portables entre distintas implementaciones de persistencia.
- **`@Controller`**: detectado por `DispatcherServlet` para mapeo de requests HTTP. Sin esto, Spring MVC no lo detecta como handler.
- **`@Service`**: NO tiene comportamiento tecnico adicional. Solo semantico: indica que es logica de negocio.
- **`@Component`**: el stereotype base para cualquier componente gestionado por Spring.

## 3. ¿Qué es un Proxy en Spring y por qué importa?

Spring no usa tus clases directamente para AOP (transacciones, cache, seguridad). Las envuelve en un proxy que intercepta las llamadas.

```
Tu codigo llama a: orderService.create()
Spring entrega el PROXY, no el objeto real

Proxy.create() {
    // logica de AOP antes (abrir transaccion, verificar permisos)
    realObject.create(); // llamada al objeto real
    // logica de AOP despues (commit, metricas)
}
```

**Por que importa**: si llamas `this.create()` dentro de la misma clase, bypaseas el proxy. El AOP no aplica.

**JDK Proxy**: solo funciona si la clase implementa una interfaz. Crea un proxy que implementa la misma interfaz.
**CGLIB**: crea una subclase de tu clase en runtime. Mas flexible, pero no funciona con clases `final`.

## 4. ¿BeanFactory vs ApplicationContext?

`ApplicationContext` extiende `BeanFactory` y agrega:
- Soporte para eventos (`ApplicationEvent`)
- Internacionalizacion (`MessageSource`)
- Carga ansiosa de beans singleton (detecta errores al arrancar)
- Soporte para AOP integrado
- Auto-deteccion de `BeanPostProcessor` y `BeanFactoryPostProcessor`

**Respuesta en entrevista**: "Siempre uso `ApplicationContext`. `BeanFactory` es la interfaz base historica, pero `ApplicationContext` agrega todo lo necesario para aplicaciones modernas. La unica razon para usar `BeanFactory` seria memoria extremadamente limitada, lo cual es raro hoy en dia."

## 5. ¿Lazy Loading vs Eager Loading en JPA?

```java
// EAGER: carga la relacion junto con la entidad principal (siempre, aunque no la necesites)
@ManyToOne(fetch = FetchType.EAGER) // default para @ManyToOne y @OneToOne
private Customer customer;

// LAZY: carga la relacion solo cuando la accedes (proxy hasta ese momento)
@OneToMany(fetch = FetchType.LAZY) // default para @OneToMany y @ManyToMany
private List<OrderItem> items;
```

**Problema del Lazy**: `LazyInitializationException` cuando accedes a la coleccion fuera de la transaccion.

```java
// En el controller - FUERA de la transaccion del service:
Order order = orderService.findById(1L); // transaccion cerrada
order.getItems().size(); // LazyInitializationException!
```

**Soluciones**:
1. Cargar con JOIN FETCH dentro de la transaccion
2. Usar DTOs (proyecciones) en lugar de entidades fuera del service
3. `spring.jpa.open-in-view=false` (importante para arquitectura limpia)

## 6. ¿Qué es spring.jpa.open-in-view?

Por default en Spring Boot, `spring.jpa.open-in-view=true`. Esto mantiene la sesion de Hibernate abierta durante toda la request HTTP (incluso en el controller y la vista). Permite que el lazy loading funcione en el controller, pero:

**Problemas**:
- Conexiones de DB abiertas durante toda la request (incluye tiempo de serializar JSON)
- Acoplamiento entre la capa web y la capa de persistencia
- Queries "ocultas" en el controller que son dificiles de detectar

**Recomendacion senior**: deshabilitarlo (`spring.jpa.open-in-view=false`) y manejar el lazy loading explicitamente con JOIN FETCH o DTOs.

---

# Tips para Diferenciarte como Senior

## Explica el "por que", no solo el "como"

| Junior dice | Senior dice |
|---|---|
| "Uso constructor injection" | "Uso constructor injection porque garantiza inmutabilidad (campo final), hace las dependencias visibles en el contrato publico de la clase, y permite detectar ciclos al arrancar en lugar de en runtime. Ademas, facilita el testing sin Spring." |
| "Uso @Transactional" | "Uso @Transactional en la capa de service, no en la de controller ni repository. Lo configuro con el nivel de propagation correcto y rollbackFor Exception.class para no perder excepciones checked. Y siempre tengo en mente que self-invocation no aplica." |

## Menciona trade-offs

- "JOIN FETCH resuelve N+1 pero con paginacion puede cargar datos en memoria. Para ese caso prefiero @BatchSize o dos queries separadas."
- "BCrypt es seguro pero lento. En escenarios de alta concurrencia de login, puede ser un cuello de botella. El factor de costo debe calibrarse."
- "Cache mejora latencia pero introduce complejidad de invalidacion. Si los datos cambian frecuentemente, el TTL debe ser corto o la cache puede hacer mas dano que bien."

## Habla de produccion

- Circuit breakers (Resilience4j) para llamadas a servicios externos
- Rate limiting en APIs publicas
- Graceful shutdown para no perder requests en deploys
- Connection pool sizing (HikariCP) segun la carga esperada
- Monitoreo de consumer lag en Kafka
- Alertas basadas en metricas de Micrometer
