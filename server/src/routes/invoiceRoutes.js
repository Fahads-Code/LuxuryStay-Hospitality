import { Router } from 'express';
import * as invoices from '../controllers/invoiceController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin', 'manager', 'receptionist'));

router.get('/', invoices.listInvoices);
router.post('/', invoices.createInvoice);
router.get('/:id', invoices.getInvoice);
router.post('/:id/items', invoices.addInvoiceItems);
router.post('/:id/pay', invoices.payInvoice);
router.post('/:id/void', invoices.voidInvoice);

export default router;
