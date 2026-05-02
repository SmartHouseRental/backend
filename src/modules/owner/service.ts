import prisma from '../../config/database';

export async function getOwnerAnalytics(ownerId: string) {
  const properties = await prisma.property.findMany({
    where: {
      ownerId,
      isDeleted: false,
    },
    select: {
      id: true,
      title: true,
      viewsCount: true,
      price: true,
      status: true,
    },
  });

  const propertyIds = properties.map((p) => p.id);

  const appointments = await prisma.appointment.findMany({
    where: {
      ownerId,
    },
    select: {
      propertyId: true,
      status: true,
    },
  });

  const totalViews = properties.reduce((sum, p) => sum + p.viewsCount, 0);

  const totalBookings = appointments.filter(
    (a) => a.status === 'CONFIRMED'
  ).length;

  const bookingRate =
    totalViews > 0 ? Number(((totalBookings / totalViews) * 100).toFixed(1)) : 0;

  const rentedProperties = properties.filter(
    (p) => p.status === 'RENTED'
  ).length;

  const occupancyRate =
    properties.length > 0
      ? Number(((rentedProperties / properties.length) * 100).toFixed(1))
      : 0;

  const revenue = properties
    .filter((p) => p.status === 'RENTED')
    .reduce((sum, p) => sum + p.price, 0);

  const topProperties = properties
    .sort((a, b) => b.viewsCount - a.viewsCount)
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      title: p.title,
      views: p.viewsCount,
      revenue: p.price,
    }));

  const viewsChart = [
    { month: 'Oct', views: 400 },
    { month: 'Nov', views: 700 },
    { month: 'Dec', views: 900 },
    { month: 'Jan', views: 1200 },
    { month: 'Feb', views: 1500 },
    { month: 'Mar', views: totalViews },
  ];

  const revenueChart = [
    { month: 'Oct', revenue: 120000 },
    { month: 'Nov', revenue: 180000 },
    { month: 'Dec', revenue: 210000 },
    { month: 'Jan', revenue: 260000 },
    { month: 'Feb', revenue: 340000 },
    { month: 'Mar', revenue },
  ];

  return {
    summary: {
      totalViews,
      bookingRate,
      revenue,
      occupancyRate,
    },
    topProperties,
    viewsChart,
    revenueChart,
  };
}