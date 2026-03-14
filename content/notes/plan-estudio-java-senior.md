---
title: "Plan de Estudio - Entrevista Java Senior"
description: "Plan de estudio intensivo de Java para entrevistas senior en 1 día."
tags: ["java", "senior", "plan-estudio"]
date: "2024-01-01"
---

# Plan de Estudio - Entrevista Java Senior

> Fecha de entrevista: mañana | Tiempo disponible: ~1 dia

---

## Prioridad ALTA - Dominar estos temas si o si

### 1. Core Java Avanzado

#### Generics
- Wildcards: `? extends T` (covariante) vs `? super T` (contravariante)
- Type erasure: qué es y sus implicaciones en runtime
- Bounded type parameters

```java
// Covariante - solo lectura
List<? extends Number> nums = new ArrayList<Integer>();

// Contravariante - solo escritura
List<? super Integer> nums2 = new ArrayList<Number>();
```

#### Concurrencia (MUY preguntado)
- `synchronized` vs `ReentrantLock` vs `volatile`
- `ExecutorService`, `ThreadPoolExecutor`, `ForkJoinPool`
- `CompletableFuture` y encadenamiento de tareas
- Problemas clasicos: deadlock, race condition, livelock, starvation
- `CountDownLatch`, `CyclicBarrier`, `Semaphore`
- Colecciones thread-safe: `ConcurrentHashMap`, `CopyOnWriteArrayList`

```java
// CompletableFuture - ejemplo tipico de entrevista
CompletableFuture.supplyAsync(() -> fetchData())
    .thenApply(data -> process(data))
    .thenAccept(result -> save(result))
    .exceptionally(ex -> { log(ex); return null; });
```

#### Memoria y JVM
- Heap vs Stack vs Metaspace
- Garbage Collectors: G1GC, ZGC, Shenandoah - diferencias
- Fases del GC: mark, sweep, compact
- Strong, Weak, Soft, Phantom references
- `OutOfMemoryError` vs `StackOverflowError` - causas

#### Streams y Lambdas
- Operaciones intermedias vs terminales
- `flatMap` vs `map`
- `Collectors`: `groupingBy`, `partitioningBy`, `toMap`
- Streams paralelos: cuando usarlos y cuando no
- Optional: uso correcto y antipatrones

```java
// Ejemplo complejo de Streams
Map<String, Long> countByCategory = items.stream()
    .filter(i -> i.isActive())
    .collect(Collectors.groupingBy(Item::getCategory, Collectors.counting()));
```

---

### 2. Patrones de Diseno

#### Los mas preguntados en Senior

| Patron | Uso tipico | Pregunta tipica |
|--------|-----------|-----------------|
| Singleton | Configuracion, conexiones | Thread-safe con double-checked locking |
| Factory / Abstract Factory | Creacion de objetos | Diferencia entre los dos |
| Builder | Objetos complejos | vs telescoping constructor |
| Observer | Eventos, pub/sub | vs Listener |
| Strategy | Algoritmos intercambiables | vs Template Method |
| Decorator | Agregar comportamiento | vs Herencia |
| Proxy | Lazy loading, AOP | JDK Proxy vs CGLIB |
| Command | Undo/redo, colas | vs Strategy |

```java
// Singleton thread-safe - pregunta clasica
public class Singleton {
    private static volatile Singleton instance;

    private Singleton() {}

    public static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) {
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

---

### 3. Spring Framework

#### Spring Core
- IoC Container: `BeanFactory` vs `ApplicationContext`
- Ciclo de vida del Bean: `@PostConstruct`, `@PreDestroy`, `InitializingBean`
- Scopes: `singleton`, `prototype`, `request`, `session`
- Inyeccion: constructor (preferida) vs field vs setter - por que constructor es mejor
- `@Conditional`, `@Profile`, `@Qualifier`, `@Primary`
- `@Value` vs `@ConfigurationProperties`

#### Spring Boot
- Auto-configuration: como funciona `@EnableAutoConfiguration`
- `spring.factories` / `AutoConfiguration.imports`
- Actuator: endpoints importantes (`/health`, `/metrics`, `/env`)
- Profiles: configuracion por ambiente

#### Spring Data JPA
- `@Entity`, `@MappedSuperclass`, `@Embeddable`
- Relaciones: `@OneToMany(fetch = LAZY)` - por que LAZY es default y mejor
- N+1 problem: como detectarlo y solucionarlo con `@EntityGraph` o JOIN FETCH
- `@Transactional`: propagation, isolation levels
- Proyecciones: interface projections vs DTO projections

```java
// Solucion N+1 con JOIN FETCH
@Query("SELECT u FROM User u JOIN FETCH u.orders WHERE u.id = :id")
Optional<User> findByIdWithOrders(@Param("id") Long id);
```

#### Spring Security
- Filtro chain: como funciona
- JWT: validacion, refresh tokens
- `@PreAuthorize`, `@PostAuthorize`
- CSRF: cuando deshabilitarlo y por que (APIs REST stateless)

---

### 4. Bases de Datos

#### SQL Avanzado
- Indices: B-Tree vs Hash, composite index, covering index
- `EXPLAIN ANALYZE` - como leer el plan de ejecucion
- Window functions: `ROW_NUMBER()`, `RANK()`, `LAG()`, `LEAD()`
- CTEs (WITH clause) vs subqueries - cuando usar cada uno
- Transacciones ACID
- Isolation levels: Read Uncommitted, Read Committed, Repeatable Read, Serializable
- Problemas: dirty read, phantom read, non-repeatable read

```sql
-- Window function - pregunta frecuente
SELECT
    employee_id,
    salary,
    RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) as rank
FROM employees;
```

#### JPA / Hibernate
- Diferencia entre `save()` y `saveAndFlush()`
- Estados de entidad: Transient, Persistent, Detached, Removed
- `@Version` para optimistic locking
- Caching: L1 (Session), L2 (SessionFactory), Query Cache

---

## Prioridad MEDIA - Conocer bien

### 5. Arquitectura y Diseno de Sistemas

#### Microservicios
- Patron Saga: choreography vs orchestration
- Circuit Breaker con Resilience4j
- API Gateway: routing, rate limiting, auth
- Service Discovery: Eureka, Consul
- Event sourcing vs CQRS
- Comunicacion: REST vs gRPC vs messaging

#### Principios SOLID
- **S**: Single Responsibility - una razon para cambiar
- **O**: Open/Closed - abierto a extension, cerrado a modificacion
- **L**: Liskov Substitution - subtipos reemplazables
- **I**: Interface Segregation - interfaces especificas, no gordas
- **D**: Dependency Inversion - depender de abstracciones

#### Clean Architecture / Hexagonal
- Capas: Domain, Application, Infrastructure, Presentation
- Ports & Adapters
- Dependency rule: dependencias hacia adentro

---

### 6. Mensajeria y Eventos

#### Kafka
- Topics, Partitions, Consumer Groups
- Offsets y commits: auto-commit vs manual
- At-least-once vs exactly-once semantics
- Retention policies
- Kafka Streams vs Kafka Consumer API

#### RabbitMQ
- Exchange types: Direct, Topic, Fanout, Headers
- Dead Letter Queue (DLQ)
- Acknowledgements: auto-ack vs manual-ack

---

### 7. Colecciones Java

#### Complejidades (debes saberte de memoria)

| Estructura | get | add | remove | contains |
|------------|-----|-----|--------|----------|
| ArrayList | O(1) | O(1) amort. | O(n) | O(n) |
| LinkedList | O(n) | O(1) | O(1) | O(n) |
| HashMap | O(1) | O(1) | O(1) | O(1) |
| TreeMap | O(log n) | O(log n) | O(log n) | O(log n) |
| HashSet | O(1) | O(1) | O(1) | O(1) |
| TreeSet | O(log n) | O(log n) | O(log n) | O(log n) |
| PriorityQueue | O(n) | O(log n) | O(log n) | O(n) |

- `HashMap` interno: load factor, rehashing, treeify en Java 8+
- `LinkedHashMap`: orden de insercion
- `TreeMap`: orden natural o Comparator

---

### 8. Testing

- Piramide de testing: unit > integration > e2e
- JUnit 5: `@Test`, `@BeforeEach`, `@ParameterizedTest`, `@ExtendWith`
- Mockito: `@Mock`, `@InjectMocks`, `@Spy`, `when().thenReturn()`, `verify()`
- `@SpringBootTest` vs `@WebMvcTest` vs `@DataJpaTest` - diferencias y cuando usar
- TDD: ciclo red-green-refactor
- TestContainers: para integration tests con bases de datos reales

```java
// Ejemplo Mockito
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock
    OrderRepository repository;

    @InjectMocks
    OrderService service;

    @Test
    void shouldCreateOrder() {
        when(repository.save(any())).thenReturn(new Order(1L));
        Order result = service.create(new OrderRequest());
        assertThat(result.getId()).isEqualTo(1L);
        verify(repository).save(any());
    }
}
```

---

## Prioridad BAJA - Mencionar si surge

### 9. Algoritmos y Estructuras de Datos

Problemas clasicos que pueden aparecer:
- Invertir una LinkedList
- Detectar ciclo en LinkedList (Floyd's algorithm)
- Binary Search
- BFS / DFS en grafos
- Two pointers
- Sliding window

```java
// Binary Search - clasico
public int binarySearch(int[] arr, int target) {
    int left = 0, right = arr.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}
```

### 10. DevOps y Observabilidad

- Docker: Dockerfile buenas practicas, multi-stage builds
- Kubernetes: Pod, Deployment, Service, Ingress, ConfigMap, Secret
- CI/CD: pipeline basico
- Observabilidad: Logs (structured logging), Metrics (Prometheus/Micrometer), Traces (OpenTelemetry)
- `@Timed`, `@Counted` de Micrometer

---

## Preguntas de Comportamiento (no ignorar)

Prepara respuestas con el metodo **STAR** (Situacion, Tarea, Accion, Resultado):

- "Cuéntame de un sistema complejo que hayas diseñado"
- "Como manejaste un conflicto tecnico con tu equipo"
- "Como mejoraste el rendimiento de una aplicacion"
- "Que decisiones tecnicas te arrepientes y por que"
- "Como te mantienes actualizado"

---

## Cronograma para Hoy

| Horario | Tema | Tiempo |
|---------|------|--------|
| Bloque 1 | Concurrencia + JVM | 1.5h |
| Bloque 2 | Spring Core + Data + Security | 2h |
| Bloque 3 | Patrones de diseno | 1h |
| Bloque 4 | BD + SQL + JPA internals | 1h |
| Bloque 5 | Arquitectura + Microservicios | 1h |
| Bloque 6 | Colecciones + Streams repaso | 45min |
| Bloque 7 | Testing | 30min |
| Bloque 8 | Preguntas comportamiento | 30min |
| Noche | Repaso rapido de puntos debiles | 30min |

---

## Tips para la Entrevista

1. **Piensa en voz alta** - explica tu razonamiento mientras resuelves
2. **Pregunta antes de asumir** - clarifica requerimientos del problema
3. **Menciona trade-offs** - no existe solucion perfecta, todo tiene costos
4. **Si no sabes algo, dilo** - y muestra como lo buscarias/resolverias
5. **Habla de experiencia real** - conecta conceptos con proyectos anteriores
6. **Complejidad de algoritmos** - siempre menciona Big O
7. **Consideraciones de produccion** - logging, monitoring, error handling, escalabilidad

---

## Conceptos que Diferencian un Senior

- Sabe cuando NO usar un patron o tecnologia
- Piensa en observabilidad desde el inicio
- Considera el impacto en el equipo, no solo la solucion tecnica
- Habla de deuda tecnica y como gestionarla
- Conoce los limites de las abstracciones que usa
- Tiene opinion fundamentada sobre arquitectura
- Mentoring y code review como parte del rol
