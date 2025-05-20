import React, { useState } from 'react';
import {
  MobileNavigation,
  MobileTable,
  MobileForm,
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormSelect,
  MobileFormTextarea,
  MobileFormCheckbox,
  MobileFormActions,
  MobileTableColumn
} from '../components/mobile';
import Button from '../components/ui/Button/Button';
import styles from './MobileDesignSystemTest.module.css';

interface TestData {
  id: string;
  name: string;
  status: string;
  date: string;
}

/**
 * Mobile Design System Test Page
 *
 * This page is used to test and validate the mobile design system components
 * in a real application context.
 */
const MobileDesignSystemTest: React.FC = () => {
  // Form state
  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    type: 'solicitud',
    message: '',
    terms: false
  });

  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Table data
  const tableData: TestData[] = [
    { id: '1', name: 'Solicitud de Permiso', status: 'Aprobado', date: '2023-05-15' },
    { id: '2', name: 'Renovación de Licencia', status: 'Pendiente', date: '2023-06-20' },
    { id: '3', name: 'Cambio de Domicilio', status: 'Rechazado', date: '2023-04-10' }
  ];

  // Table columns
  const tableColumns: MobileTableColumn<TestData>[] = [
    {
      id: 'name',
      header: 'Solicitud',
      cell: (item) => item.name,
      sortable: true,
      mobilePriority: 1
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (item) => (
        <span className={`${styles.status} ${styles[item.status.toLowerCase()]}`}>
          {item.status}
        </span>
      ),
      sortable: true,
      mobilePriority: 2
    },
    {
      id: 'date',
      header: 'Fecha',
      cell: (item) => new Date(item.date).toLocaleDateString('es-MX'),
      sortable: true,
      mobilePriority: 3
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: () => (
        <div className={styles.tableActions}>
          <Button variant="primary" size="small">Ver</Button>
        </div>
      ),
      sortable: false,
      mobilePriority: 4
    }
  ];

  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setFormValues({
      ...formValues,
      [name]: type === 'checkbox' ? checked : value
    });

    // Clear error when field is changed
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const errors: Record<string, string> = {};

    if (!formValues.name.trim()) {
      errors.name = 'El nombre es requerido';
    }

    if (!formValues.email.trim()) {
      errors.email = 'El correo electrónico es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formValues.email)) {
      errors.email = 'El correo electrónico no es válido';
    }

    if (!formValues.message.trim()) {
      errors.message = 'El mensaje es requerido';
    }

    if (!formValues.terms) {
      errors.terms = 'Debes aceptar los términos y condiciones';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Form is valid, submit it
    alert('Formulario enviado con éxito');
    console.log('Form values:', formValues);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Prueba del Sistema de Diseño Móvil</h1>
        <p className={styles.pageDescription}>
          Esta página prueba los componentes del sistema de diseño móvil optimizados para dispositivos comunes en México.
        </p>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tabla Responsiva</h2>
          <p className={styles.sectionDescription}>
            Esta tabla se transforma en tarjetas en dispositivos móviles (prueba en pantallas menores a 576px).
          </p>

          <MobileTable
            data={tableData}
            columns={tableColumns}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => alert(`Seleccionaste: ${item.name}`)}
            pagination={true}
            itemsPerPage={5}
            initialSortColumn="date"
            initialSortDirection="desc"
          />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Formulario Móvil</h2>
          <p className={styles.sectionDescription}>
            Formulario optimizado para entrada táctil en dispositivos móviles.
          </p>

          <MobileForm
            title="Formulario de Contacto"
            description="Completa el formulario para enviarnos tu mensaje."
            onSubmit={handleSubmit}
          >
            <MobileFormGroup>
              <MobileFormLabel htmlFor="name" required>Nombre</MobileFormLabel>
              <MobileFormInput
                id="name"
                name="name"
                placeholder="Tu nombre"
                value={formValues.name}
                onChange={handleInputChange}
                error={formErrors.name}
                required
              />
            </MobileFormGroup>

            <MobileFormGroup>
              <MobileFormLabel htmlFor="email" required>Correo Electrónico</MobileFormLabel>
              <MobileFormInput
                id="email"
                name="email"
                type="email"
                placeholder="tu@correo.com"
                value={formValues.email}
                onChange={handleInputChange}
                error={formErrors.email}
                required
              />
            </MobileFormGroup>

            <MobileFormGroup>
              <MobileFormLabel htmlFor="type">Tipo de Solicitud</MobileFormLabel>
              <MobileFormSelect
                id="type"
                name="type"
                value={formValues.type}
                onChange={handleInputChange}
                options={[
                  { value: 'solicitud', label: 'Solicitud de Permiso' },
                  { value: 'renovacion', label: 'Renovación' },
                  { value: 'consulta', label: 'Consulta' }
                ]}
              />
            </MobileFormGroup>

            <MobileFormGroup>
              <MobileFormLabel htmlFor="message" required>Mensaje</MobileFormLabel>
              <MobileFormTextarea
                id="message"
                name="message"
                placeholder="Escribe tu mensaje aquí..."
                value={formValues.message}
                onChange={handleInputChange}
                error={formErrors.message}
                required
                rows={4}
              />
            </MobileFormGroup>

            <MobileFormGroup>
              <MobileFormCheckbox
                id="terms"
                name="terms"
                label="Acepto los términos y condiciones"
                checked={formValues.terms}
                onChange={handleInputChange}
                error={formErrors.terms}
              />
            </MobileFormGroup>

            <MobileFormActions>
              <Button variant="secondary" type="button">Cancelar</Button>
              <Button variant="primary" type="submit">Enviar Mensaje</Button>
            </MobileFormActions>
          </MobileForm>
        </section>
      </div>

      <div className={styles.navContainer}>
        <MobileNavigation type="bottom" isAuthenticated={true} />
      </div>
    </div>
  );
};

export default MobileDesignSystemTest;
