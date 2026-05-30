# Component Library

SIPHON-X frontend component library built with React, TypeScript, and Tailwind CSS.

## UI Components (shadcn/ui)

### Button
Botón con variantes y tamaños.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| variant | `'default' \| 'outline' \| 'ghost' \| 'destructive'` | `'default'` | Estilo visual |
| size | `'default' \| 'sm' \| 'lg' \| 'icon'` | `'default'` | Tamaño |

**Example**:
```tsx
<Button variant="outline" size="sm">Click me</Button>
```

### Input
Campo de texto con soporte para errores.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| error | `string` | `undefined` | Mensaje de error |
| label | `string` | `undefined` | Label del campo |

**Example**:
```tsx
<Input label="Email" error="Email inválido" />
```

### Badge
Etiqueta con variantes de color.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| variant | `'default' \| 'success' \| 'warning' \| 'danger'` | `'default'` | Color |

**Example**:
```tsx
<Badge variant="success">Active</Badge>
```

### Card
Contenedor con bordes y padding.

**Example**:
```tsx
<Card>
  <CardHeader>Title</CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Dialog
Modal con focus trap y cierre con Escape.

**Example**:
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>Title</DialogHeader>
    <p>Content</p>
  </DialogContent>
</Dialog>
```

### Tabs
Navegación por pestañas.

**Example**:
```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

---

## Data Components

### DataTable
Tabla de datos con sorting, filtering, pagination y bulk actions.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| columns | `ColumnDef[]` | required | Definición de columnas |
| data | `T[]` | required | Datos a mostrar |
| searchable | `boolean` | `true` | Habilitar búsqueda |
| pagination | `{ pageSize: number }` | `{ pageSize: 20 }` | Configuración de paginación |
| bulkActions | `BulkAction[]` | `[]` | Acciones masivas |

**Example**:
```tsx
const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
]

<DataTable
  columns={columns}
  data={leads}
  searchable
  pagination={{ pageSize: 20 }}
  bulkActions={[
    { label: 'Delete', onClick: (rows) => deleteLeads(rows) }
  ]}
/>
```

---

## Chart Components

### AreaChart
Gráfico de área con gradiente (lazy loaded).

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| data | `DataPoint[]` | required | Datos del gráfico |
| dataKey | `string` | required | Key del valor Y |
| color | `string` | `'indigo'` | Color del área |

**Example**:
```tsx
<AreaChart
  data={chartData}
  dataKey="value"
  color="indigo"
/>
```

### MetricCard
Tarjeta de métrica con sparkline opcional.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| title | `string` | required | Título de la métrica |
| value | `number \| string` | required | Valor principal |
| trend | `'up' \| 'down' \| 'neutral'` | `undefined` | Tendencia |
| sparklineData | `number[]` | `undefined` | Datos del sparkline |

**Example**:
```tsx
<MetricCard
  title="Total Leads"
  value={1247}
  trend="up"
  sparklineData={[10, 15, 12, 18, 20]}
/>
```

### TrendIndicator
Indicador de tendencia con flecha y porcentaje.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| trend | `'up' \| 'down' \| 'neutral'` | required | Dirección |
| value | `number` | required | Porcentaje |

**Example**:
```tsx
<TrendIndicator trend="up" value={12.5} />
```

### Sparkline
Mini gráfico de línea inline.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| data | `number[]` | required | Datos |
| width | `number` | `80` | Ancho en px |
| height | `number` | `32` | Alto en px |

**Example**:
```tsx
<Sparkline data={[10, 15, 12, 18, 20]} />
```

---

## Domain Components

### StatusLED
Indicador de estado con glow effect.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| status | `'success' \| 'warning' \| 'danger' \| 'neutral'` | required | Estado |
| size | `'sm' \| 'md' \| 'lg'` | `'md'` | Tamaño |

**Example**:
```tsx
<StatusLED status="success" size="md" />
```

### Chip
Etiqueta removible con variantes.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| variant | `'default' \| 'outline' \| 'solid'` | `'default'` | Estilo |
| onRemove | `() => void` | `undefined` | Callback al remover |

**Example**:
```tsx
<Chip variant="solid" onRemove={() => removeTag('tag1')}>
  Tag 1
</Chip>
```

### LeadCard
Tarjeta de lead con avatar y métricas.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| lead | `Lead` | required | Datos del lead |
| onClick | `() => void` | `undefined` | Callback al hacer click |

**Example**:
```tsx
<LeadCard lead={lead} onClick={() => navigate(`/leads/${lead.id}`)} />
```

### TabGroup
Grupo de tabs con variantes.

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| tabs | `Tab[]` | required | Lista de tabs |
| activeTab | `string` | required | Tab activa |
| variant | `'underline' \| 'pills'` | `'underline'` | Estilo |

**Example**:
```tsx
<TabGroup
  tabs={[
    { id: 'overview', label: 'Overview' },
    { id: 'audit', label: 'Audit' },
  ]}
  activeTab="overview"
  variant="underline"
/>
```

---

## Layout Components

### Sidebar
Barra lateral de navegación (colapsable en mobile).

**Example**:
```tsx
<Sidebar />
```

### Header
Header con navegación y acciones.

**Example**:
```tsx
<Header />
```

### PageContainer
Contenedor de página con padding y max-width.

**Example**:
```tsx
<PageContainer>
  <h1>Page Title</h1>
  <p>Content</p>
</PageContainer>
```

---

## Accessibility

Todos los componentes siguen WCAG 2.1 AA:
- **Keyboard navigation**: Tab, arrow keys, Escape
- **ARIA labels**: Todos los iconos tienen `aria-label` o `aria-hidden`
- **Focus management**: Focus trap en Dialog, focus rings visibles
- **Color contrast**: Mínimo 4.5:1 para texto normal, 3:1 para texto grande

## Design Tokens

Ver `src/styles/design-tokens.ts` para todos los tokens de diseño:
- Colores: Indigo (#6366f1), Purple (#a855f7), Slate backgrounds
- Tipografía: Geist (headlines), Inter (body), JetBrains Mono (code)
- Spacing: 4px base unit
- Border radius: 4px (sm), 8px (md), 12px (lg)
