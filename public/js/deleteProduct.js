function deleteProduct(productId) {
    Swal.fire({
        title: 'Are you sure?',
        text: "This product will be deleted. This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        background: '#1f2937',
        color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            // Create a form to submit the POST request
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `/admin/deleteProduct/${productId}`;
            document.body.appendChild(form);
            form.submit();
        }
    });
}
