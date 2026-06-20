import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';

const uploadPlayerPhoto = createUploadHandler('players');

app.post('/squad', { preHandler: [uploadPlayerPhoto] }, async (request, reply) => {
  const body = request.body as any;
  const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

  if (!body.categoryId || !body.name) {
    return reply.code(422).send({ error: 'Campos obrigatórios: categoryId, name.' });
  }
  const player = await prisma.squadMember.create({
    data: {
      categoryId: body.categoryId,
      name: body.name.trim(),
      position: body.position,
      shirtNumber: body.shirtNumber !== undefined ? Number(body.shirtNumber) : undefined,
      photoUrl: uploadedFile?.path,
      birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
    },
  });
  return reply.code(201).send(player);
});

app.patch('/squad/:id', { preHandler: [uploadPlayerPhoto] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as any;
  const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

  if (uploadedFile) {
    const existing = await prisma.squadMember.findUnique({ where: { id } });
    if (existing?.photoUrl) await deleteImageSafe(existing.photoUrl);
  }

  const player = await prisma.squadMember.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name.trim() }),
      ...(body.position !== undefined && { position: body.position }),
      ...(body.shirtNumber !== undefined && { shirtNumber: body.shirtNumber === null ? null : Number(body.shirtNumber) }),
      ...(uploadedFile && { photoUrl: uploadedFile.path }),
      ...(body.birthDate !== undefined && { birthDate: body.birthDate ? new Date(body.birthDate) : null }),
      ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
    },
  });
  return reply.send(player);
});