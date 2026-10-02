'use client';

import {lazy} from 'react';

export const GlobalLinkOrder=lazy(()=>import('./global-link-order').then(module=>({default:module.GlobalLinkOrder})));
export const StoresDirectory=lazy(()=>import('./stores-directory').then(module=>({default:module.StoresDirectory})));
export const AccountView=lazy(()=>import('./account-views').then(module=>({default:module.AccountView})));
export const LoginView=lazy(()=>import('./login-view').then(module=>({default:module.LoginView})));
export const CustomsView=lazy(()=>import('./account-views').then(module=>({default:module.CustomsView})));
export const CartView=lazy(()=>import('./shopping').then(module=>({default:module.CartView})));
export const OrdersView=lazy(()=>import('./order-workspace').then(module=>({default:module.OrdersView})));
export const BalanceView=lazy(()=>import('./order-workspace').then(module=>({default:module.BalanceView})));
export const NotificationsView=lazy(()=>import('./order-workspace').then(module=>({default:module.NotificationsView})));
export const AnalyticsView=lazy(()=>import('./prelaunch-views').then(module=>({default:module.AnalyticsView})));
export const LegalDocuments=lazy(()=>import('./legal-documents').then(module=>({default:module.LegalDocuments})));
export const DeclarationView=lazy(()=>import('./identity-workspace').then(module=>({default:module.DeclarationView})));
export const IdentityView=lazy(()=>import('./identity-workspace').then(module=>({default:module.IdentityView})));
export const BatchImportView=lazy(()=>import('./batch-import').then(module=>({default:module.BatchImportView})));
export const AdminView=lazy(()=>import('./admin-view').then(module=>({default:module.AdminView})));
